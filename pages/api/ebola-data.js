/**
 * /api/ebola-data — EBOLA-MONITOR v4.5.5
 *
 * SOURCE PRIMAIRE : INSP RDC PDF quotidiens — https://insp.cd/blog-2/
 *
 * VRAIS CHIFFRES SitRep N°017/MVB_31/2026 (PDF lu 01/06/2026) :
 *   Cumul cas confirmés            : 321
 *   Cumul décès confirmés          : 48
 *   CFR                            : 15.0%  (48/321)
 *   Cas suspects en investigation  : 104    (actifs du jour, pas cumulatif)
 *   Cas confirmés actifs isolement : 238
 *   Guéris cumulés                 : 6
 *   Taux suivi contacts            : 43%    (cible: 95%)
 *   Zones de santé touchées        : 23     (Ituri:15, NK:7, SK:1)
 *   Provinces                      : 3      (Ituri, Nord-Kivu, Sud-Kivu)
 *   Ituri                          : 299 cas, 46 décès, CFR 15.4%
 *   Nord-Kivu                      : 19 cas, 1 décès, CFR 5.3%
 *   Sud-Kivu                       : 3 cas, 1 décès, CFR 33.3%
 *   Nouveaux cas 31 mai            : 12 (Rwampara:5, Bunia:4, Nyankunde:1, Logo:1, Nizi:1)
 *
 * AUTOMATISATION :
 *   Edge Function insp-scraper (Supabase) appelée par cron Vercel 08h00 UTC
 *   Niveau 1 : INSP WordPress REST API
 *   Niveau 2 : ReliefWeb API
 *   Fallback : données statiques ci-dessous (derniers chiffres vérifiés)
 */

import { supabase } from '../../lib/supabase';
import { HISTORICAL_DATA, DRC_HISTORY_BASE, RT_METADATA, RISK_FACTORS_BASE } from '../../lib/historical-data';

const FALLBACK_SNAPSHOT = {
  confirmed_cases         : 321,
  suspected_cases         : 104,
  confirmed_deaths        : 48,
  total_deaths_all        : null,
  cfr_confirmed           : 15.0,
  recovered_estimated     : 6,
  confirmed_active        : 238,
  uganda_confirmed        : 9,
  uganda_deaths           : 1,
  countries_affected      : 2,
  health_zones_affected   : 23,
  data_as_of              : '2026-06-01T00:00:00Z',
  source                  : 'INSP RDC SitRep MVE N°017/MVB_31/2026 — PDF 01 juin 2026 [SOURCE OFFICIELLE RDC]',
  source_url              : 'https://insp.cd/wp-content/uploads/2026/06/SitRep_MVE_RDC_N017_01_06_2026-Revised_JO_PA_IM-1.pdf',

  contact_tracing: {
    suspects_en_investigation  : 104,
    confirmes_actifs_isolement : 238,
    gueris_cumul               : 6,
    contact_tracing_rate_pct   : 43.0,
    contact_tracing_target_pct : 95.0,
    contact_tracing_ituri_pct  : 35.0,
    patients_en_isolement_total: 129,
    echantillons_collectes_24h : 65,
    echantillons_positifs_24h  : 12,
    taux_positivite_pct        : 66.6,
    echantillons_en_attente    : 47,
    alertes_remontees_24h      : 192,
    alertes_investiguees_pct   : 88.5,
    voyageurs_POE_24h          : 14057,
    voyageurs_screnes_pct      : 98.8,
    source                     : 'INSP RDC N°017',
    source_date                : '2026-06-01',
  },

  trend: {
    source      : 'INSP RDC SitReps MVE N°001–017 PDF officiels',
    source_url  : 'https://insp.cd/blog-2/',
    note        : 'Confirmés=cumulés. Suspects=actifs jour J (INSP). 12 nouveaux cas 31 mai.',
    dates            : ['15 mai','17 mai','19 mai','21 mai','23 mai','26 mai','28 mai','01 juin'],
    confirmed        : [8,       10,      22,      31,      101,     121,     125,     321],
    suspected_active : [null,    null,    null,    null,    null,    null,    null,    104],
    deaths_conf      : [1,       2,       5,       7,       null,    17,      17,      48],
    recovered        : [0,       0,       0,       0,       null,    0,       0,       6],
    new_cases_24h    : [null,    null,    null,    null,    null,    null,    null,    12],
  },

  provinces: [
    { province:'Ituri',     cases:299, deaths:46, cfr:15.4, zones_touchees:15, zones_total:36, pct_zones:41.7, new_cases_24h:12, country:'DRC',    source:'INSP N°017', source_date:'2026-06-01',
      zones:['Aru','Aungba','Bambu','Bunia','Damas','Gety','Kilo','Komanda','Lita','Logo','Mangala','Mongbwalu','Nizi','Nyankunde','Rwampara'] },
    { province:'Nord-Kivu', cases:19,  deaths:1,  cfr:5.3,  zones_touchees:7,  zones_total:34, pct_zones:20.6, new_cases_24h:0,  country:'DRC',    source:'INSP N°017', source_date:'2026-06-01',
      zones:['Beni','Butembo','Goma','Kalunguta','Katwa','Kyondo','Oicha'] },
    { province:'Sud-Kivu',  cases:3,   deaths:1,  cfr:33.3, zones_touchees:1,  zones_total:34, pct_zones:2.9,  new_cases_24h:0,  country:'DRC',    source:'INSP N°017', source_date:'2026-06-01',
      zones:['Miti-Murhesa'] },
    { province:'Uganda',    cases:9,   deaths:1,  cfr:11.1, zones_touchees:null, zones_total:null, pct_zones:null, new_cases_24h:null, country:'Uganda', source:'WHO DON603', source_date:'2026-05-20',
      zones:[] },
  ],

  sources_comparison: [
    {
      name:'INSP RDC SitRep N°017/MVB_31 (PDF officiel)',
      date:'2026-06-01', confirmed_cases:321, suspected_cases:104, confirmed_deaths:48,
      confirmed_active:238, confirmed_recovered:6, contact_tracing_rate_pct:43.0, health_zones:23, new_cases_24h:12,
      note:'SOURCE OFFICIELLE. 321 cas cumulés, 238 actifs isolement, 104 suspects investigation, 6 guéris, 48 décès, CFR 15.0%. 23 ZS. 12 nouveaux cas 31 mai.',
      url:'https://insp.cd/wp-content/uploads/2026/06/SitRep_MVE_RDC_N017_01_06_2026-Revised_JO_PA_IM-1.pdf',
      is_primary:true,
    },
    { name:'WHO DON603', date:'2026-05-20', confirmed_cases:121, confirmed_deaths:17,
      note:'Retard 12j. 121 vs 321 cas (+200). 17 vs 48 décès (+31).',
      url:'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603' },
    { name:'ECDC Rapid Risk', date:'2026-05-28', confirmed_cases:125, suspected_cases:1077, confirmed_deaths:17,
      note:'4j retard. Suspects ECDC=cumul depuis début. INSP=actifs du jour. Méthodes différentes.',
      url:'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda' },
  ],

  source_discrepancies: {
    title: 'Pourquoi les chiffres diffèrent entre sources ?',
    reasons: [
      { label:'INSP = source primaire temps réel',
        detail:'PDF quotidien. N°017 (01/06): 321 cas, 48 décès, CFR 15%. WHO DON603 (20/05): 121 cas, 17 décès — 12 jours retard.' },
      { label:'Suspects INSP = actifs du jour (PAS cumulatifs)',
        detail:'INSP: 104 suspects actifs en investigation. ECDC/WHO: cumul depuis début (ȧ1000). Ne pas comparer directement.' },
      { label:'Données en cours d’harmonisation',
        detail:'Note PDF INSP: *Données en cours d’harmonisation. Chiffres définitifs peuvent varier légèrement dans les sitreps suivants.' },
      { label:'Délai rapportage',
        detail:'INSP: quotidien. WHO DON: 10–12j. ECDC: 2x/semaine. Auto-parse erroné exclu (parse_confidence=auto_invalid).' },
    ],
    consensus: 'Source retenue: INSP N°017 PDF (01/06/2026). 321 confirmés cumulés, 104 suspects actifs, 48 décès, 6 guéris, 238 actifs, CFR 15.0%, suivi contacts 43%.',
  },
};

function parseField(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return null; } }
  return val;
}

function mergeWithFallback(raw) {
  const provinces            = parseField(raw.provinces);
  const trend                = parseField(raw.trend);
  const contact_tracing      = parseField(raw.contact_tracing);
  const sources_comparison   = parseField(raw.sources_comparison);
  const source_discrepancies = parseField(raw.source_discrepancies);

  let normalizedTrend = null;
  if (trend && Array.isArray(trend.dates) && trend.dates.length > 0) {
    normalizedTrend = {
      source           : trend.source      || FALLBACK_SNAPSHOT.trend.source,
      source_url       : trend.source_url  || FALLBACK_SNAPSHOT.trend.source_url,
      note             : trend.note        || FALLBACK_SNAPSHOT.trend.note,
      dates            : trend.dates,
      confirmed        : trend.confirmed        || [],
      suspected_active : trend.suspected_active || [],
      deaths_conf      : trend.deaths_conf      || [],
      recovered        : trend.recovered        || [],
      new_cases_24h    : trend.new_cases_24h    || [],
    };
  }

  const rawActive = raw.confirmed_active ??
    (raw.confirmed_cases != null && raw.confirmed_deaths != null && raw.recovered_estimated != null
      ? raw.confirmed_cases - raw.confirmed_deaths - raw.recovered_estimated : null);

  return {
    confirmed_cases         : raw.confirmed_cases         ?? FALLBACK_SNAPSHOT.confirmed_cases,
    suspected_cases         : raw.suspected_cases         ?? FALLBACK_SNAPSHOT.suspected_cases,
    confirmed_deaths        : raw.confirmed_deaths        ?? FALLBACK_SNAPSHOT.confirmed_deaths,
    total_deaths_all        : raw.total_deaths_all        ?? FALLBACK_SNAPSHOT.total_deaths_all,
    cfr_confirmed           : raw.cfr_confirmed           ?? FALLBACK_SNAPSHOT.cfr_confirmed,
    recovered_estimated     : raw.recovered_estimated     ?? FALLBACK_SNAPSHOT.recovered_estimated,
    confirmed_active        : rawActive                   ?? FALLBACK_SNAPSHOT.confirmed_active,
    uganda_confirmed        : raw.uganda_confirmed        ?? FALLBACK_SNAPSHOT.uganda_confirmed,
    uganda_deaths           : raw.uganda_deaths           ?? FALLBACK_SNAPSHOT.uganda_deaths,
    countries_affected      : raw.countries_affected      ?? FALLBACK_SNAPSHOT.countries_affected,
    health_zones_affected   : raw.health_zones_affected   ?? FALLBACK_SNAPSHOT.health_zones_affected,
    data_as_of              : raw.data_as_of              || FALLBACK_SNAPSHOT.data_as_of,
    source                  : raw.source                  || FALLBACK_SNAPSHOT.source,
    source_url              : raw.source_url              || FALLBACK_SNAPSHOT.source_url,
    provinces               : (provinces && Array.isArray(provinces) && provinces.length) ? provinces : FALLBACK_SNAPSHOT.provinces,
    trend                   : normalizedTrend || FALLBACK_SNAPSHOT.trend,
    contact_tracing         : (contact_tracing && contact_tracing.contact_tracing_rate_pct != null) ? contact_tracing : FALLBACK_SNAPSHOT.contact_tracing,
    sources_comparison      : (sources_comparison && Array.isArray(sources_comparison) && sources_comparison.length) ? sources_comparison : FALLBACK_SNAPSHOT.sources_comparison,
    source_discrepancies    : (source_discrepancies && source_discrepancies.title) ? source_discrepancies : FALLBACK_SNAPSHOT.source_discrepancies,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=14400, stale-while-revalidate=28800');

  let rawSnapshot = null;
  let supabaseError = null;

  try {
    const { data, error } = await supabase
      .from('outbreak_snapshots')
      .select('*')
      .neq('parse_confidence', 'auto_invalid')
      .order('data_as_of', { ascending: false })
      .limit(1)
      .single();
    if (error) throw error;
    rawSnapshot = data;
  } catch (err) {
    supabaseError = err.message;
  }

  const snapshot = rawSnapshot ? mergeWithFallback(rawSnapshot) : FALLBACK_SNAPSHOT;
  const confirmedActive = snapshot.confirmed_active
    ?? (snapshot.confirmed_cases - (snapshot.confirmed_deaths||0) - (snapshot.recovered_estimated||0));

  const drcHistory = [
    ...DRC_HISTORY_BASE,
    { label:'2026 (en cours)', cases:snapshot.confirmed_cases, deaths:snapshot.confirmed_deaths, cfr:snapshot.cfr_confirmed },
  ];

  const allData = [
    ...HISTORICAL_DATA,
    { year:2026, country:'DRC',    cases:snapshot.confirmed_cases,  deaths:snapshot.confirmed_deaths, cfr:snapshot.cfr_confirmed, species:'Bundibugyo', status:'Ongoing' },
    { year:2026, country:'Uganda', cases:snapshot.uganda_confirmed, deaths:snapshot.uganda_deaths, cfr: snapshot.uganda_confirmed ? parseFloat(((snapshot.uganda_deaths/snapshot.uganda_confirmed)*100).toFixed(1)) : 0, species:'Bundibugyo', status:'Ongoing' },
  ];

  res.status(200).json({
    success       : true,
    generated_at  : new Date().toISOString(),
    data_as_of    : snapshot.data_as_of,
    data_source   : supabaseError ? 'FALLBACK_STATIC' : 'Supabase (data_as_of DESC, excl. auto_invalid)',
    primary_source: 'INSP RDC — https://insp.cd/blog-2/',
    supabase_error: supabaseError || null,
    automation    : { edge_function:'insp-scraper', cron:'0 8 * * * UTC', fallback_levels:['INSP WordPress API','ReliefWeb API','static fallback'] },
    disclaimer    : 'Source primaire: INSP RDC PDF quotidiens (insp.cd/blog-2). Complété par WHO, ECDC, MSF.',
    methodology: {
      primary_source    : 'INSP RDC SitReps MVE PDF quotidiens (insp.cd/blog-2).',
      suspects_insp     : 'suspected_cases = suspects ACTIFS du jour (INSP). PAS cumulatif. ECDC/WHO = cumul.',
      confirmed_active  : 'confirmed_active = confirmés - décès - guéris.',
      cfr               : 'CFR = Décès confirmés / Cas confirmés × 100.',
      insp_sitrep_list  : 'https://insp.cd/blog-2/',
      note_harmonisation: 'Note INSP PDF: *Données en cours d’harmonisation.',
    },
    outbreak_2026: {
      meta: {
        declaration_date    : '2026-05-15',
        pheic_date          : '2026-05-17',
        virus               : 'Bundibugyo ebolavirus (BDBV)',
        outbreak_number     : 17,
        no_approved_vaccine : true,
        index_case          : 'Infirmière, Zone de santé de Mongbwalu, Ituri',
        last_data_update    : snapshot.data_as_of,
        last_verified_by    : snapshot.source,
        primary_source_url  : snapshot.source_url,
        sitrep_list_url     : 'https://insp.cd/blog-2/',
      },
      totals: {
        confirmed_cases       : snapshot.confirmed_cases,
        suspected_cases_active: snapshot.suspected_cases,
        confirmed_deaths      : snapshot.confirmed_deaths,
        confirmed_active      : confirmedActive,
        confirmed_recovered   : snapshot.recovered_estimated,
        cfr_confirmed         : snapshot.cfr_confirmed,
        uganda_confirmed      : snapshot.uganda_confirmed,
        uganda_deaths         : snapshot.uganda_deaths,
        countries_affected    : snapshot.countries_affected,
        health_zones_affected : snapshot.health_zones_affected,
        source                : snapshot.source,
        note_suspects         : 'suspected_cases_active = cas suspects ACTIFS du jour (INSP). Pas cumulatif.',
      },
      sources_comparison   : snapshot.sources_comparison,
      source_discrepancies : snapshot.source_discrepancies,
      provinces            : snapshot.provinces,
      trend                : snapshot.trend,
      contact_tracing      : snapshot.contact_tracing,
      rt                   : RT_METADATA,
      risk_factors         : RISK_FACTORS_BASE,
    },
    historical             : allData,
    drc_history_comparison : drcHistory,
  });
}
