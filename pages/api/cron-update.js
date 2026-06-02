/**
 * /api/cron-update — EBOLA-MONITOR v4.5.2
 *
 * Veille multi-sources avec INSP RDC comme source primaire.
 *
 * Liste officielle SitReps : https://insp.cd/blog-2/
 * Pattern URL SitRep       : https://insp.cd/sitrep-n{NNN}-mvb_{JJ}-2026/
 * Exemple N°017            : https://insp.cd/sitrep-n017-mvb_31-2026/
 *
 * Ordre de priorité sources :
 *   1. INSP RDC     — insp.cd/blog-2/           (quotidien)
 *   2. WHO AFRO     — afro.who.int              (2x/semaine)
 *   3. ECDC         — ecdc.europa.eu            (2x/semaine)
 *   4. WHO DON      — who.int/emergencies/don   (~10 jours)
 */

import { supabase } from '../../lib/supabase';

const WATCH_SOURCES = [
  { name: 'INSP RDC',    priority: 1, type: 'primary',   list_url: 'https://insp.cd/blog-2/',                                                                                         note: 'Source officielle MinSanté RDC. SitReps MVE quotidiens. Pattern: sitrep-n{NNN}-mvb_{JJ}-2026/' },
  { name: 'WHO AFRO',    priority: 2, type: 'secondary', list_url: 'https://www.afro.who.int/health-topics/ebola-virus-disease',                                                       note: 'Bureau régional WHO Afrique' },
  { name: 'WHO DON',     priority: 3, type: 'secondary', list_url: 'https://www.who.int/emergencies/situations/ebola-outbreak---drc-2026',                                             note: 'Disease Outbreak News WHO — ~10 jours retard sur INSP' },
  { name: 'ECDC',        priority: 4, type: 'secondary', list_url: 'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda',                 note: 'Rapid risk assessment ECDC — 2x/semaine' },
  { name: 'ReliefWeb',   priority: 5, type: 'secondary', list_url: 'https://reliefweb.int/updates?search=ebola+DRC+sitrep&source=INSP',                                                note: 'Miroir ReliefWeb des sitreps INSP — utile si insp.cd inaccessible' },
];

/**
 * Scrape insp.cd/blog-2/ pour détecter le dernier numéro de sitrep MVE.
 * Pattern attendu : /sitrep-n(\d+)-mvb_\d+-2026/
 */
async function fetchLatestInspSitrep() {
  try {
    const res = await fetch('https://insp.cd/blog-2/', {
      headers: { 'User-Agent': 'EBOLA-MONITOR/4.5 (surveillance santé publique)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Pattern : sitrep-nNNN-mvb_JJ-2026
    const matches = [...html.matchAll(/href="(https?:\/\/insp\.cd\/sitrep-n(\d+)-mvb_\d+-2026\/)"/g)];
    if (!matches.length) return null;

    matches.sort((a, b) => parseInt(b[2]) - parseInt(a[2]));
    return { url: matches[0][1], number: parseInt(matches[0][2]) };
  } catch (e) {
    console.warn('[cron] INSP fetch failed:', e.message);
    return null;
  }
}

/**
 * Fallback : chercher sur ReliefWeb si INSP inaccessible.
 * ReliefWeb reprend les sitreps INSP avec données textuelles.
 */
async function fetchFromReliefWeb() {
  try {
    const url = 'https://api.reliefweb.int/v1/reports?appname=ebola-monitor&filter[field]=source.shortname&filter[value]=INSP&filter[field2]=title&filter[value2]=SitRep MVE&sort[]=date:desc&limit=3';
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const items = data?.data || [];
    if (!items.length) return null;
    return items.map(i => ({ title: i.fields.title, date: i.fields.date?.created, url: i.fields.url_alias }));
  } catch (e) {
    console.warn('[cron] ReliefWeb fetch failed:', e.message);
    return null;
  }
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const log = [];
  const now = new Date().toISOString();
  log.push(`[${now}] cron-update v4.5.2 started`);

  // Lire le dernier sitrep connu depuis Supabase
  let lastSitrepNumber = 17; // N°017 est le dernier intégré
  let lastDataAsOf     = null;
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
      lastDataAsOf = data.data_as_of;
    }
    log.push(`Last known sitrep: N°${lastSitrepNumber}, data_as_of: ${lastDataAsOf}`);
  } catch (e) {
    log.push(`Supabase read error: ${e.message}`);
  }

  // Tenter INSP
  const inspLatest = await fetchLatestInspSitrep();
  let newSitrep    = null;
  let reliefData   = null;

  if (inspLatest) {
    log.push(`INSP latest sitrep: N°${inspLatest.number} — ${inspLatest.url}`);
    if (inspLatest.number > lastSitrepNumber) {
      newSitrep = inspLatest;
      log.push(`⚠️ NEW SitRep detected: N°${inspLatest.number} (was N°${lastSitrepNumber})`);
      log.push(`ACTION: Update FALLBACK_SNAPSHOT in ebola-data.js with data from ${inspLatest.url}`);
    } else {
      log.push(`INSP: no new sitrep (still N°${inspLatest.number})`);
    }
  } else {
    log.push('INSP insp.cd/blog-2/ inaccessible — trying ReliefWeb fallback...');
    reliefData = await fetchFromReliefWeb();
    if (reliefData) {
      log.push(`ReliefWeb found ${reliefData.length} items: ${reliefData.map(i => i.title).join(' | ')}`);
    } else {
      log.push('ReliefWeb also failed. All sources unavailable.');
    }
  }

  const watchResults = WATCH_SOURCES.map(s => ({ ...s, checked: now }));

  return res.status(200).json({
    success: true,
    timestamp: now,
    new_sitrep_available: !!newSitrep,
    latest_insp_sitrep: newSitrep || (inspLatest ? { number: inspLatest.number, url: inspLatest.url } : null),
    last_known_sitrep: lastSitrepNumber,
    reliefweb_fallback: reliefData,
    watch_sources: watchResults,
    priority_source: {
      name:          'INSP RDC',
      description:   'Institut National de Santé Publique — MinSanté RDC',
      sitrep_list:   'https://insp.cd/blog-2/',
      url_pattern:   'https://insp.cd/sitrep-n{NNN}-mvb_{JJ}-2026/',
      latest_known:  `https://insp.cd/sitrep-n017-mvb_31-2026/`,
      frequency:     'Quotidien',
      last_checked:  now,
    },
    log,
  });
}
