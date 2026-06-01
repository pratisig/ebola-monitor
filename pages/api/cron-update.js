/**
 * /api/cron-update — Mise à jour automatique des données
 *
 * CORRECTIONS:
 * - Suppression de l'import invalide FALLBACK_SNAPSHOT depuis ebola-data
 * - trend écrit avec suspected_ecdc ET suspected_msf
 * - Fallback sur snapshot complet si lastFull null
 */

import { supabaseAdmin } from '../../lib/supabase';
import { fetchWHOData, fetchECDCData } from '../../lib/who-fetcher';

export default async function handler(req, res) {
  const authHeader   = req.headers['authorization'];
  const cronSecret   = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isBearerAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isVercelCron && !isBearerAuth) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  console.log('[cron-update] Starting data refresh at', new Date().toISOString());

  // 1. Lire le dernier snapshot complet
  const { data: lastFull } = await supabaseAdmin
    .from('outbreak_snapshots')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // 2. Tenter de récupérer les nouvelles données WHO puis ECDC
  let newData = await fetchWHOData();
  if (!newData || !newData.confirmed_cases) {
    console.warn('[cron-update] WHO parse failed, trying ECDC...');
    newData = await fetchECDCData();
  }

  if (!newData || !newData.confirmed_cases) {
    console.error('[cron-update] Both WHO and ECDC fetch failed.');
    return res.status(200).json({
      success: false,
      message: 'Parsing échoué (WHO + ECDC). Données existantes conservées.',
      last_snapshot_date: lastFull?.created_at,
    });
  }

  // 3. Vérifier si les chiffres ont changé
  const hasChanged = !lastFull ||
    lastFull.confirmed_cases !== newData.confirmed_cases ||
    lastFull.suspected_cases !== newData.suspected_cases;

  if (!hasChanged) {
    console.log('[cron-update] No change detected.');
    return res.status(200).json({
      success: true,
      message: 'Aucun changement détecté.',
      confirmed_cases: newData.confirmed_cases,
    });
  }

  // 4. Construire le trend mis à jour
  // Parser le trend existant (peut être une string JSON selon type colonne Supabase)
  let existingTrend = lastFull?.trend || null;
  if (typeof existingTrend === 'string') {
    try { existingTrend = JSON.parse(existingTrend); } catch(e) { existingTrend = null; }
  }
  if (!existingTrend) {
    existingTrend = { dates:[], confirmed:[], suspected_ecdc:[], suspected_msf:[], deaths_conf:[], deaths_all:[] };
  }

  const today = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
  let updatedTrend = existingTrend;

  if (!existingTrend.dates.includes(today)) {
    updatedTrend = {
      ...existingTrend,
      dates:          [...(existingTrend.dates          || []), today],
      confirmed:      [...(existingTrend.confirmed      || []), newData.confirmed_cases],
      suspected_ecdc: [...(existingTrend.suspected_ecdc || existingTrend.suspected || []), newData.suspected_cases || lastFull?.suspected_cases || 0],
      suspected_msf:  [...(existingTrend.suspected_msf  || []), null],
      deaths_conf:    [...(existingTrend.deaths_conf    || []), newData.confirmed_deaths || lastFull?.confirmed_deaths || 0],
      deaths_all:     [...(existingTrend.deaths_all     || []), lastFull?.total_deaths_all || 0],
    };
  }

  // 5. Construire le nouveau snapshot
  const newSnapshot = {
    confirmed_cases:       newData.confirmed_cases,
    suspected_cases:       newData.suspected_cases  || lastFull?.suspected_cases,
    confirmed_deaths:      newData.confirmed_deaths || lastFull?.confirmed_deaths,
    cfr_confirmed:         newData.cfr_confirmed    || lastFull?.cfr_confirmed,
    total_deaths_all:      lastFull?.total_deaths_all,
    suspected_note:        lastFull?.suspected_note,
    uganda_confirmed:      lastFull?.uganda_confirmed,
    uganda_deaths:         lastFull?.uganda_deaths,
    countries_affected:    lastFull?.countries_affected,
    health_zones_affected: lastFull?.health_zones_affected,
    provinces:             lastFull?.provinces,
    contact_tracing:       lastFull?.contact_tracing,
    sources_comparison:    lastFull?.sources_comparison,
    source_discrepancies:  lastFull?.source_discrepancies,
    trend:                 updatedTrend,
    source:                `${newData.source} (auto-parse) — ${new Date().toLocaleDateString('fr-FR')}`,
    source_url:            newData.source_url,
    data_as_of:            new Date().toISOString(),
    parse_confidence:      'auto',
  };

  const { error: insertError } = await supabaseAdmin
    .from('outbreak_snapshots')
    .insert([newSnapshot]);

  if (insertError) {
    console.error('[cron-update] Insert failed:', insertError.message);
    return res.status(500).json({ success: false, error: insertError.message });
  }

  console.log('[cron-update] Snapshot inserted:', newData.confirmed_cases, 'confirmed cases');
  return res.status(200).json({
    success: true,
    message: 'Nouveau snapshot inséré',
    confirmed_cases: newData.confirmed_cases,
    suspected_cases: newData.suspected_cases,
    source: newData.source,
  });
}
