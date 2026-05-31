/**
 * /api/cron-update — Mise à jour automatique des données
 *
 * Déclenché par le cron Vercel toutes les 4 heures (vercel.json)
 * Peut aussi être appelé manuellement avec l'en-tête:
 *   Authorization: Bearer CRON_SECRET
 *
 * Flux:
 * 1. Tente de parser les données depuis WHO (page officielle)
 * 2. Si WHO indisponible, tente ECDC
 * 3. Si les deux échouent: garde les données existantes, log l'erreur
 * 4. Si de nouvelles données sont trouvées: insère dans Supabase
 *    et flag parse_confidence='auto' pour indiquer mise à jour automatique
 *
 * IMPORTANT: Le cron détecte des changements de chiffres, pas de contenu textuel.
 * Pour une mise à jour manuelle vérifiée, utiliser l'interface Supabase directement.
 */

import { supabaseAdmin } from '../../lib/supabase';
import { fetchWHOData, fetchECDCData } from '../../lib/who-fetcher';

export default async function handler(req, res) {
  // Sécurité: vérifier le secret cron (configuré dans Vercel env vars)
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;

  // Vercel appelle les crons avec x-vercel-signature
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isBearerAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isVercelCron && !isBearerAuth) {
    return res.status(401).json({ error: 'Non autoris\u00e9' });
  }

  console.log('[cron-update] Starting data refresh at', new Date().toISOString());

  // 1. Lire le dernier snapshot en base
  const { data: lastSnapshot } = await supabaseAdmin
    .from('outbreak_snapshots')
    .select('confirmed_cases, suspected_cases, created_at, trend')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // 2. Tenter de récupérer les nouvelles données
  let newData = await fetchWHOData();
  if (!newData) {
    console.warn('[cron-update] WHO parse failed, trying ECDC...');
    newData = await fetchECDCData();
  }

  if (!newData || !newData.confirmed_cases) {
    console.error('[cron-update] Both WHO and ECDC fetch failed. No update performed.');
    return res.status(200).json({
      success: false,
      message: 'Parsing échoué (WHO + ECDC). Données existantes conservées.',
      last_snapshot_date: lastSnapshot?.created_at,
    });
  }

  // 3. Vérifier si les chiffres ont changé
  const hasChanged = !lastSnapshot ||
    lastSnapshot.confirmed_cases !== newData.confirmed_cases ||
    lastSnapshot.suspected_cases !== newData.suspected_cases;

  if (!hasChanged) {
    console.log('[cron-update] No change detected, skipping insert.');
    return res.status(200).json({
      success: true,
      message: 'Aucun changement détecté. Base de données à jour.',
      confirmed_cases: newData.confirmed_cases,
    });
  }

  // 4. Construire le nouveau snapshot
  // Pour les données non disponibles via parsing auto (provinces, trend),
  // on hérite du dernier snapshot manuel/vérifié en base
  const { data: lastFull } = await supabaseAdmin
    .from('outbreak_snapshots')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Mettre à jour les données trend (ajouter le nouveau point)
  let updatedTrend = lastFull?.trend || { dates:[], confirmed:[], suspected:[] };
  const today = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
  if (!updatedTrend.dates.includes(today)) {
    updatedTrend = {
      ...updatedTrend,
      dates:     [...updatedTrend.dates,     today],
      confirmed: [...updatedTrend.confirmed, newData.confirmed_cases],
      suspected: [...updatedTrend.suspected, newData.suspected_cases || lastFull?.suspected_cases || 0],
    };
  }

  const newSnapshot = {
    // Données mises à jour automatiquement
    confirmed_cases:  newData.confirmed_cases,
    suspected_cases:  newData.suspected_cases  || lastFull?.suspected_cases,
    confirmed_deaths: newData.confirmed_deaths || lastFull?.confirmed_deaths,
    cfr_confirmed:    newData.cfr_confirmed    || lastFull?.cfr_confirmed,
    // Données héritées du dernier snapshot complet (mis à jour manuellement)
    total_deaths_all:      lastFull?.total_deaths_all,
    cfr_note:              `CFR = ${newData.confirmed_deaths || lastFull?.confirmed_deaths} / ${newData.confirmed_cases} \u00d7 100 = ${newData.cfr_confirmed || lastFull?.cfr_confirmed}%`,
    suspected_note:        lastFull?.suspected_note,
    uganda_confirmed:      lastFull?.uganda_confirmed,
    uganda_deaths:         lastFull?.uganda_deaths,
    countries_affected:    lastFull?.countries_affected,
    health_zones_affected: lastFull?.health_zones_affected,
    provinces:             lastFull?.provinces,
    contact_tracing:       lastFull?.contact_tracing,
    trend:                 updatedTrend,
    // Métadonnées
    source:             `${newData.source} (auto-parse) — ${new Date().toLocaleDateString('fr-FR')}`,
    source_url:         newData.source_url,
    data_as_of:         new Date().toISOString(),
    parse_confidence:   'auto',
  };

  const { error: insertError } = await supabaseAdmin
    .from('outbreak_snapshots')
    .insert([newSnapshot]);

  if (insertError) {
    console.error('[cron-update] Insert failed:', insertError.message);
    return res.status(500).json({ success: false, error: insertError.message });
  }

  console.log(`[cron-update] Snapshot inserted: ${newData.confirmed_cases} confirmed cases`);
  return res.status(200).json({
    success: true,
    message: 'Nouveau snapshot inséré',
    confirmed_cases: newData.confirmed_cases,
    suspected_cases: newData.suspected_cases,
    source: newData.source,
  });
}
