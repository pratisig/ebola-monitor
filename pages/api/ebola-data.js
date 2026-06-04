/**
 * /api/ebola-data — EBOLA-MONITOR v4.5.6
 *
 * SOURCE PRIMAIRE : INSP RDC PDF quotidiens — https://insp.cd/blog-2/
 *
 * VRAIS CHIFFRES SitRep N°018 (01/06/2026) :
 *   Cumul cas confirmés            : 344
 *   Cumul décès confirmés          : 60
 *   CFR                            : 17.4%  (60/344)
 *   Cas suspects en investigation  : 116    (actifs du jour)
 *   Guéris cumulés                 : 6
 *   Ituri                          : 322 cas — 16 ZS
 *   Nord-Kivu                      : 19 cas — 7 ZS
 *   Sud-Kivu                       : 3 cas — 1 ZS
 *   23 nouveaux cas vs veille
 *
 * VRAIS CHIFFRES SitRep N°019/MVB_02/2026 (02/06/2026) — DERNIÈRE VERSION :
 *   Cumul cas confirmés            : 363   (+19 en 24h)
 *   Cumul décès confirmés          : 62
 *   CFR                            : 17.1%  (62/363)
 *   Hospitalisés ou en isolement   : 206
 *   Guéris cumulés                 : 6
 *   Uganda confirmés               : 15 (dont 1 décès)
 *
 * Sources: MinSanté RDC, ECDC (updated 3 June 13:30), WHO, Reuters/AFP
 */

import { supabase } from '../../lib/supabase';
import { HISTORICAL_DATA, DRC_HISTORY_BASE, RT_METADATA, RISK_FACTORS_BASE } from '../../lib/historical-data';

const FALLBACK_SNAPSHOT = {
  confirmed_cases         : 363,
  suspected_cases         : 116,
  confirmed_deaths        : 62,
  total_deaths_all        : null,
  cfr_confirmed           : 17.1,
  recovered_estimated     : 6,
  confirmed_active        : 206,
  uganda_confirmed        : 15,
  uganda_deaths           : 1,
  countries_affected      : 2,
  health_zones_affected   : 24,
  data_as_of              : '2026-06-02T00:00:00Z',
  source                  : 'INSP RDC SitRep MVE N°019/MVB_02/2026 — 02 juin 2026 [SOURCE OFFICIELLE RDC]',
  source_url              : 'https://insp.cd/blog-2/',

  contact_tracing: {
    suspects_en_investigation  : 116,
    confirmes_actifs_isolement : 206,
    gueris_cumul               : 6,
    contact_tracing_rate_pct   : 45.0,
    contact_tracing_target_pct : 95.0,
    contact_tracing_ituri_pct  : 38.0,
    patients_en_isolement_total: 206,
    echantillons_collectes_24h : null,
    echantillons_positifs_24h  : 19,
    taux_positivite_pct        : null,
    echantillons_en_attente    : null,
    alertes_remontees_24h      : null,
    alertes_investiguees_pct   : null,
    voyageurs_POE_24h          : null,
    voyageurs_screnes_pct      : null,
    source                     : 'INSP RDC N°019 + WHO 03/06/2026',
    source_date                : '2026-06-02',
  },

  trend: {
    source      : 'INSP RDC SitReps MVE N°001–019 PDF officiels',
    source_url  : 'https://insp.cd/blog-2/',
    note        : 'Confirmés=cumulés. Suspects=actifs jour J (INSP). +19 nouveaux cas 02 juin.',
    dates            : ['15 mai','17 mai','19 mai','21 mai','23 mai','26 mai','28 mai','01 juin','01 juin (N018)','02 juin (N019)'],
    confirmed        : [8,       10,      22,      31,      101,     121,     125,     321,     344,             363],
    suspected_active : [null,    null,    null,    null,    null,    null,    null,    104,     116,             116],
    deaths_conf      : [1,       2,       5,       7,       null,    17,      17,      48,      60,              62],
    recovered        : [0,       0,       0,       0,       null,    0,       0,       6,       6,               6],
    new_cases_24h    : [null,    null,    null,    null,    null,    null,    null,    12,      23,              19],
  },

  provinces: [
    { province:'Ituri',     cases:335, deaths:58, cfr:17.3, zones_touchees:16, zones_total:36, pct_zones:44.4, new_cases_24h:17, country:'DRC',    source:'INSP N°019 / ECDC 03/06', source_date:'2026-06-02',
      zones:['Aru','Aungba','Bambu','Bunia','Damas','Gety','Kilo','Komanda','Lita','Logo','Mangala','Mongbwalu','Nizi','Nyankunde','Rwampara','Fataki'] },
    { province:'Nord-Kivu', cases:22,  deaths:3,  cfr:13.6, zones_touchees:7,  zones_total:34, pct_zones:20.6, new_cases_24h:2,  country:'DRC',    source:'INSP N°019 / ECDC 03/06', source_date:'2026-06-02',
      zones:['Beni','Butembo','Goma','Kalunguta','Katwa','Kyondo','Oicha'] },
    { province:'Sud-Kivu',  cases:6,   deaths:1,  cfr:16.7, zones_touchees:1,  zones_total:34, pct_zones:2.9,  new_cases_24h:0,  country:'DRC',    source:'INSP N°019 / ECDC 03/06', source_date:'2026-06-02',
      zones:['Miti-Murhesa'] },
    { province:'Uganda',    cases:15,  deaths:1,  cfr:6.7,  zones_touchees:null, zones_total:null, pct_zones:null, new_cases_24h:null, country:'Uganda', source:'WHO 03/06/2026', source_date:'2026-06-03',
      zones:['Kampala','Wakiso'] },
  ],

  sources_comparison: [
    {
      name:'INSP RDC SitRep N°019/MVB_02 (source officielle)',
      date:'2026-06-02', confirmed_cases:363, suspected_cases:116, confirmed_deaths:62,
      confirmed_active:206, confirmed_recovered:6, contact_tracing_rate_pct:45.0, health_zones:24, new_cases_24h:19,
      note:'SOURCE OFFICIELLE. 363 cas cumulés (+19 le 02/06), 206 actifs/isolement, 116 suspects investigation, 6 guéris, 62 décès, CFR 17.1%.',
      url:'https://insp.cd/blog-2/',
      is_primary:true,
    },
    { name:'ECDC Rapid Risk (mis à jour 03 juin 13h30)', date:'2026-06-02', confirmed_cases:344, confirmed_deaths:60,
      suspected_cases:116,
      note:'Réf. SitRep N°018 (01/06). 344 cas, 60 décès. Mise à jour ECDC 03/06 13:30.',
      url:'https://www.ecdc.europa.eu/en/ebola-outbreak-democratic-republic-congo-and-uganda' },
    { name:'WHO / Reuters 03 juin 2026', date:'2026-06-03', confirmed_cases:344, confirmed_deaths:60,
      note:'WHO confirme 344 cas, 60 décès au 03/06. +Uganda 15 cas 1 décès.',
      url:'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603' },
    { name:'WHO DON603 (ancienne)', date:'2026-05-20', confirmed_cases:121, confirmed_deaths:17,
      note:'Retard historique 12j. Remplacé par mise à jour WHO 03/06.',
      url:'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603' },
  ],

  source_discrepancies: {
    title: 'Pourquoi les chiffres diffèrent entre sources ?',
    reasons: [
      { label:'INSP N°019 = source primaire temps réel (02/06)',
        detail:'363 cas, 62 décès, CFR 17.1%. +19 nouveaux cas 02 juin. WHO/ECDC (03/06): 344 cas, 60 décès — basé sur N°018 (01/06), 1 jour de retard.' },
      { label:'Suspects INSP = actifs du jour (PAS cumulatifs)',
        detail:'INSP: 116 suspects actifs en investigation. ECDC/WHO: cumul depuis début (>1000). Ne pas comparer directement.' },
      { label:'Révision massive des suspects (OMS 02/06)',
        detail:'OMS a confirmé que les ~1000 suspects précédents incluaient des doublons/erreurs de saisie. Chiffre officiel révisé à 116 suspects actifs.' },
      { label:'Délai rapportage',
        detail:'INSP: quotidien. WHO: 1-2j retard. ECDC: 2x/semaine. Source retenue: INSP N°019 (02/06/2026).' },
    ],
    consensus: 'Source retenue: INSP N°019 (02/06/2026). 363 confirmés cumulés, 116 suspects actifs, 62 décès, 6 guéris, 206 actifs isolement, CFR 17.1%. Uganda: 15 cas, 1 décès.',
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
      confirmed_active  : 'confirmed_active = hospitalisés/isolement (INSP N°019).',
      cfr               : 'CFR = Décès confirmés / Cas confirmés × 100.',
      insp_sitrep_list  : 'https://insp.cd/blog-2/',
      note_harmonisation: 'Note INSP PDF: *Données en cours d\'harmonisation.',
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
