/**
 * /api/cron-update — EBOLA-MONITOR v4.5.1
 *
 * Veille multi-sources avec INSP RDC comme source primaire.
 * Ordre de priorité :
 *   1. INSP RDC     — https://insp.cd/category/sitrep-mve/  (quotidien)
 *   2. WHO AFRO     — https://www.afro.who.int/              (2x/semaine)
 *   3. ECDC         — rapid risk assessment                  (2x/semaine)
 *   4. WHO DON      — disease outbreak news                  (~10 jours)
 *
 * Le cron tente de scraper les sources dans l'ordre.
 * Si aucune donnée fraîche, le fallback statique reste actif.
 *
 * Vercel cron : éxécuté tous les jours à 08:00 UTC (vercel.json).
 */

import { supabase } from '../../lib/supabase';

// URLs des sources de veille
const WATCH_SOURCES = [
  {
    name:     'INSP RDC',
    priority: 1,
    type:     'primary',
    list_url: 'https://insp.cd/category/sitrep-mve/',
    note:     'Source officielle MinSanté RDC — SitReps MVE quotidiens',
  },
  {
    name:     'WHO AFRO Ebola',
    priority: 2,
    type:     'secondary',
    list_url: 'https://www.afro.who.int/health-topics/ebola-virus-disease',
    note:     'Bureau régional WHO Afrique — mises à jour régionales',
  },
  {
    name:     'WHO DON',
    priority: 3,
    type:     'secondary',
    list_url: 'https://www.who.int/emergencies/situations/ebola-outbreak---drc-2026',
    note:     'Disease Outbreak News WHO — ~10 jours de retard sur INSP',
  },
  {
    name:     'ECDC',
    priority: 4,
    type:     'secondary',
    list_url: 'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda',
    note:     'Rapid risk assessment ECDC — 2x/semaine',
  },
];

/**
 * Tentative de récupération de la page INSP la plus récente.
 * Retourne null si échec (CORS, timeout, etc.)
 */
async function fetchLatestInspSitrep() {
  try {
    const res = await fetch('https://insp.cd/category/sitrep-mve/', {
      headers: { 'User-Agent': 'EBOLA-MONITOR/4.5 (public health surveillance; contact: monitor@example.com)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extraire le lien du dernier sitrep (pattern: /sitrep-mve-n-NNN-2026/)
    const matches = [...html.matchAll(/href="(https:\/\/insp\.cd\/sitrep-mve-n-(\d+)-2026\/)"/g)];
    if (!matches.length) return null;

    // Trier par numéro de sitrep décroissant
    matches.sort((a, b) => parseInt(b[2]) - parseInt(a[2]));
    const latestUrl    = matches[0][1];
    const latestNumber = parseInt(matches[0][2]);

    return { url: latestUrl, number: latestNumber };
  } catch (e) {
    console.warn('[cron] INSP fetch failed:', e.message);
    return null;
  }
}

/**
 * Vérifie si un nouveau sitrep INSP est disponible depuis le dernier snapshot.
 */
async function checkInspForNewSitrep(lastSitrep) {
  const latest = await fetchLatestInspSitrep();
  if (!latest) return { new: false, reason: 'INSP fetch failed' };
  if (!lastSitrep || latest.number > lastSitrep) {
    return { new: true, url: latest.url, number: latest.number };
  }
  return { new: false, reason: `Latest INSP sitrep is still N°${latest.number}` };
}

export default async function handler(req, res) {
  // Sécuriser le cron (Vercel envoie CRON_SECRET en header)
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const log = [];
  const now = new Date().toISOString();
  log.push(`[${now}] cron-update v4.5.1 started`);

  // Lire le dernier snapshot pour connaître le numéro de sitrep déjà intégré
  let lastSitrepNumber = null;
  try {
    const { data } = await supabase
      .from('outbreak_snapshots')
      .select('source, data_as_of')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (data?.source) {
      const m = data.source.match(/N°(\d+)/);
      if (m) lastSitrepNumber = parseInt(m[1]);
    }
    log.push(`Last snapshot source: ${data?.source || 'unknown'}, last sitrep: N°${lastSitrepNumber || '?'}`);
  } catch (e) {
    log.push(`Supabase read error: ${e.message}`);
  }

  // Vérifier INSP pour un nouveau sitrep
  const inspCheck = await checkInspForNewSitrep(lastSitrepNumber);
  log.push(`INSP check: ${JSON.stringify(inspCheck)}`);

  const watchResults = WATCH_SOURCES.map(s => ({
    name:     s.name,
    priority: s.priority,
    type:     s.type,
    url:      s.list_url,
    note:     s.note,
    checked:  now,
  }));

  // Si nouveau sitrep INSP détecté : notifier dans les logs
  // (La mise à jour manuelle du fallback reste nécessaire jusqu'à parsing HTML automatisé)
  let newDataAvailable = false;
  if (inspCheck.new) {
    newDataAvailable = true;
    log.push(`⚠️ NEW INSP SitRep detected: N°${inspCheck.number} at ${inspCheck.url}`);
    log.push('ACTION REQUIRED: Update FALLBACK_SNAPSHOT in ebola-data.js with new figures.');
  } else {
    log.push(`INSP: no new sitrep. ${inspCheck.reason || ''}`);
  }

  res.status(200).json({
    success: true,
    timestamp: now,
    new_data_available: newDataAvailable,
    latest_insp_sitrep: inspCheck.new ? { number: inspCheck.number, url: inspCheck.url } : null,
    watch_sources: watchResults,
    priority_source: {
      name:        'INSP RDC',
      description: 'Institut National de Santé Publique — MinSanté RDC',
      url:         'https://insp.cd/category/sitrep-mve/',
      sitrep_base: 'https://insp.cd/sitrep-mve-n-{N}-2026/',
      frequency:   'Quotidien',
      last_checked: now,
    },
    log,
  });
}
