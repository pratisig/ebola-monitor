/**
 * /api/ebola-data — EBOLA-MONITOR v4.6.1
 *
 * CHANGELOG v4.6.1 (05/06/2026) :
 *  - INSP SitRep N°020 (03/06/2026) intégré en fallback statique
 *  - Provinces : Ituri 341 cas/17ZS, Nord-Kivu 19 cas/7ZS, Sud-Kivu 3 cas/1ZS → 25 ZS total
 *  - sources_comparison restauré complet (5 sources : INSP N°020, WHO 03/06,
 *    WHO Le Monde 02/06, ECDC 04/06, WHO DON603)
 *  - fallback guard dans mergeWithFallback : rejette Supabase si cas < 363
 *  - cache réduit à 1h (s-maxage=3600)
 *  - FALLBACK_STATIC_DATE mis à jour : 2026-06-03
 *
 * CORRECTIONS v4.6.0 (04/06/2026) :
 *  #2 — Supabase retenu UNIQUEMENT si data_as_of > fallback statique
 *  #5 — Cache réduit à 1h (était 4h)
 *
 * SOURCE PRIMAIRE : INSP RDC PDF quotidiens — https://insp.cd/blog-2/
 *
 * DERNIÈRES DONNÉES VÉRIFIÉES (05/06/2026) :
 *  INSP SitRep N°020 (03/06/2026) :
 *   Cas confirmés : 363 | Décès : 62 | CFR : 17.1%
 *   Ituri : 341 cas / 17 ZS | Nord-Kivu : 19 cas / 7 ZS | Sud-Kivu : 3 cas / 1 ZS
 *   Total ZS touchées : 25
 *  Uganda (ECDC 04/06/2026) : 15 cas, 1 décès
 */

import { supabase } from '../../lib/supabase';
import { HISTORICAL_DATA, DRC_HISTORY_BASE, RT_METADATA, RISK_FACTORS_BASE } from '../../lib/historical-data';

// Date du fallback statique — Supabase n'est retenu que si PLUS RÉCENT que cette date
const FALLBACK_STATIC_DATE = '2026-06-03T00:00:00Z';

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
  uganda_recovered        : 0,
  countries_affected      : 2,
  health_zones_affected   : 25,
  data_as_of              : FALLBACK_STATIC_DATE,
  source                  : 'INSP RDC SitRep MVE N°020 — 03 juin 2026 + ECDC 04/06/2026 [SOURCES OFFICIELLES]',
  source_url              : 'https://insp.cd/blog-2/',

  contact_tracing: {
    suspects_en_investigation  : 116,
    confirmes_actifs_isolement : 206,
    gueris_cumul               : 6,
    contact_tracing_rate_pct   : 45.0,
    contact_tracing_target_pct : 95.0,
    echantillons_positifs_24h  : 19,
    source                     : 'INSP RDC N°020 + ECDC 04/06/2026',
    source_date                : '2026-06-03',
  },

  trend: {
    source      : 'INSP RDC SitReps MVE N°001–020 PDF officiels',
    source_url  : 'https://insp.cd/blog-2/',
    note        : 'Confirmés=cumulés. Suspects=actifs jour J (INSP). Ituri 341/17ZS, NK 19/7ZS, SK 3/1ZS — 25 ZS total.',
    dates            : ['15 mai','17 mai','19 mai','21 mai','23 mai','26 mai','28 mai','01 juin (N017)','01 juin (N018)','02 juin (N019)','03 juin (N020)'],
    confirmed        : [8,       10,      22,      31,      101,     121,     125,     321,             344,             363,             363],
    suspected_active : [null,    null,    null,    null,    null,    null,    null,    104,             116,             116,             116],
    deaths_conf      : [1,       2,       5,       7,       null,    17,      17,      48,              60,              62,              62],
    recovered        : [0,       0,       0,       0,       null,    0,       0,       6,               6,               6,               6],
    new_cases_24h    : [null,    null,    null,    null,    null,    null,    null,    12,              23,              19,              0],
  },

  provinces: [
    { province:'Ituri',     cases:341, deaths:59, cfr:17.3, zones_touchees:17, new_cases_24h:6,    country:'DRC',    source:'INSP N°020', source_date:'2026-06-03',
      zones:['Aru','Aungba','Bambu','Bunia','Damas','Gety','Kilo','Komanda','Lita','Logo','Mangala','Mongbwalu','Nizi','Nyankunde','Rwampara','Fataki','Irumu'] },
    { province:'Nord-Kivu', cases:19,  deaths:2,  cfr:10.5, zones_touchees:7,  new_cases_24h:0,    country:'DRC',    source:'INSP N°020', source_date:'2026-06-03',
      zones:['Beni','Butembo','Goma','Kalunguta','Katwa','Kyondo','Oicha'] },
    { province:'Sud-Kivu',  cases:3,   deaths:1,  cfr:33.3, zones_touchees:1,  new_cases_24h:0,    country:'DRC',    source:'INSP N°020', source_date:'2026-06-03',
      zones:['Miti-Murhesa'] },
    { province:'Uganda',    cases:15,  deaths:1,  cfr:6.7,  zones_touchees:2,  new_cases_24h:null, country:'Uganda', source:'ECDC 04/06/2026', source_date:'2026-06-04',
      zones:['Kampala (8 cas)','Wakiso (1 cas)'] },
  ],

  sources_comparison: [
    {
      name       : 'INSP RDC SitRep N°020 (source officielle)',
      date       : '2026-06-03',
      confirmed_cases: 363, suspected_cases: 116, confirmed_deaths: 62,
      confirmed_active: 206, confirmed_recovered: 6,
      contact_tracing_rate_pct: 45.0, health_zones: 25, new_cases_24h: 0,
      note       : 'SOURCE OFFICIELLE RDC. 363 cas cumulés (stable vs N°019), 25 ZS (Ituri 341/17ZS, NK 19/7ZS, SK 3/1ZS), 206 actifs/isolement, 116 suspects actifs, 6 guéris, 62 décès, CFR 17.1%.',
      url        : 'https://insp.cd/blog-2/',
      is_primary : true,
    },
    {
      name       : 'WHO 03/06/2026',
      date       : '2026-06-03',
      confirmed_cases: 344, confirmed_deaths: 60,
      note       : 'WHO: "catching up" avec l\'épidémie. Réf. N°018 (01/06), 1j retard. Uganda: 15 cas, 1 décès.',
      url        : 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603',
    },
    {
      name       : 'WHO / Le Monde 02/06/2026',
      date       : '2026-06-02',
      confirmed_cases: 344, confirmed_deaths: 60,
      note       : 'WHO cité par Le Monde 02/06: 344 cas, 60 décès. Identique au DON603 (20/05) — retard rapportage WHO.',
      url        : 'https://www.lemonde.fr/afrique/article/2026/06/02/ebola-en-rdc',
    },
    {
      name       : 'ECDC (mis à jour 04 juin 2026)',
      date       : '2026-06-04',
      confirmed_cases: 363, confirmed_deaths: 62, suspected_cases: 116,
      note       : 'ECDC aligné sur N°019/N°020: 363 cas, 62 décès. Uganda: 15 cas (8 Kampala, 1 Wakiso), 1 décès, ≥7 transmission locale, 4 liés voyages RDC.',
      url        : 'https://www.ecdc.europa.eu/en/ebola-outbreak-democratic-republic-congo-and-uganda',
    },
    {
      name       : 'WHO DON603 (historique)',
      date       : '2026-05-20',
      confirmed_cases: 121, confirmed_deaths: 17,
      note       : 'Retard historique 12j. Remplacé par mise à jour WHO 03/06.',
      url        : 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603',
    },
  ],

  source_discrepancies: {
    title: 'Pourquoi les chiffres diffèrent entre sources ?',
    reasons: [
      { label: 'INSP N°020 = source primaire temps réel (03/06)',
        detail: '363 cas, 62 décès, CFR 17.1%, 25 ZS. WHO (03/06): 344 cas, 60 décès — basé sur N°018 (01/06), 2 jours de retard. ECDC (04/06): aligné 363 cas.' },
      { label: 'Suspects INSP = actifs du jour (PAS cumulatifs)',
        detail: 'INSP: 116 suspects actifs en investigation. ECDC/WHO: cumul depuis début. Ne pas comparer directement.' },
      { label: 'Uganda — transmission locale confirmée (ECDC 04/06)',
        detail: '15 cas Uganda: ≥7 transmission locale, 4 liés à voyages RDC. 8 cas Kampala, 1 Wakiso. 1 décès.' },
      { label: 'Délai rapportage',
        detail: 'INSP: quotidien. WHO: 1-3j retard. ECDC: 2-3×/semaine. Source DRC retenue: INSP N°020 (03/06).' },
    ],
    consensus: 'Source retenue: INSP N°020 (03/06) pour DRC + ECDC 04/06 pour Uganda. DRC: 363 confirmés, 116 suspects actifs, 62 décès, 6 guéris, CFR 17.1%, 25 ZS. Uganda: 15 cas, 1 décès.',
  },
};

function parseField(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return null; } }
  return val;
}

/** Supabase retenu UNIQUEMENT si plus récent que le fallback statique */
function shouldUseSupabase(rawDataAsOf) {
  if (!rawDataAsOf) return false;
  return new Date(rawDataAsOf) > new Date(FALLBACK_STATIC_DATE);
}

/**
 * Fallback guard : rejette Supabase si les données semblent régresser
 * (ex: auto_invalid mal filtré avec cas < baseline N°019)
 */
function isSupabaseDataSane(raw) {
  if (!raw.confirmed_cases || raw.confirmed_cases < 363) return false;
  if (raw.confirmed_deaths == null) return false;
  if (raw.cfr_confirmed && raw.cfr_confirmed > 80) return false;
  return true;
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
    uganda_recovered        : raw.uganda_recovered        ?? FALLBACK_SNAPSHOT.uganda_recovered,
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
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  let rawSnapshot = null;
  let supabaseError = null;
  let supabaseSkipped = false;

  try {
    const { data, error } = await supabase
      .from('outbreak_snapshots')
      .select('*')
      .neq('parse_confidence', 'auto_invalid')
      .order('data_as_of', { ascending: false })
      .limit(1)
      .single();
    if (error) throw error;

    if (data && shouldUseSupabase(data.data_as_of) && isSupabaseDataSane(data)) {
      rawSnapshot = data;
    } else {
      supabaseSkipped = true;
      supabaseError = `Supabase row skipped: date=${data?.data_as_of}, cases=${data?.confirmed_cases} — not newer/sane vs fallback (${FALLBACK_STATIC_DATE}, 363 cas)`;
    }
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
    { year:2026, country:'Uganda', cases:snapshot.uganda_confirmed, deaths:snapshot.uganda_deaths,    cfr: snapshot.uganda_confirmed ? parseFloat(((snapshot.uganda_deaths/snapshot.uganda_confirmed)*100).toFixed(1)) : 0, species:'Bundibugyo', status:'Ongoing' },
  ];

  res.status(200).json({
    success       : true,
    generated_at  : new Date().toISOString(),
    data_as_of    : snapshot.data_as_of,
    data_source   : rawSnapshot
      ? 'Supabase'
      : (supabaseSkipped ? 'FALLBACK_STATIC (Supabase not newer/sane)' : 'FALLBACK_STATIC (Supabase error)'),
    primary_source: 'INSP RDC — https://insp.cd/blog-2/',
    supabase_error: supabaseError || null,
    automation: {
      edge_function  : 'insp-scraper v3',
      cron           : '0 8,14 * * * UTC',
      fallback_levels: ['INSP WordPress API','ReliefWeb API','static fallback'],
    },
    disclaimer: 'Source primaire: INSP RDC PDF quotidiens (insp.cd/blog-2/). Complété par WHO, ECDC.',
    methodology: {
      primary_source       : 'INSP RDC SitReps MVE PDF quotidiens (insp.cd/blog-2/).',
      secondary_source     : 'ECDC (04/06/2026) pour Uganda et validation croisée.',
      suspects_insp        : 'suspected_cases = suspects ACTIFS du jour (INSP). PAS cumulatif.',
      confirmed_active     : 'confirmed_active = hospitalisés/isolement (INSP N°020).',
      cfr                  : 'CFR = Décès confirmés / Cas confirmés × 100.',
      fallback_static_date : FALLBACK_STATIC_DATE,
      fallback_guard       : 'Supabase rejeté si cases < 363 (baseline N°019) ou CFR > 80%',
      supabase_priority    : 'Supabase retenu si data_as_of > fallback_static_date ET données saines',
      cache_ttl            : '3600s (1h)',
      last_checked         : '2026-06-05T14:00:00Z',
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
        ecdc_url            : 'https://www.ecdc.europa.eu/en/ebola-outbreak-democratic-republic-congo-and-uganda',
        next_sitrep_expected: '2026-06-05',
      },
      totals: {
        confirmed_cases        : snapshot.confirmed_cases,
        suspected_cases_active : snapshot.suspected_cases,
        confirmed_deaths       : snapshot.confirmed_deaths,
        confirmed_active       : confirmedActive,
        confirmed_recovered    : snapshot.recovered_estimated,
        cfr_confirmed          : snapshot.cfr_confirmed,
        uganda_confirmed       : snapshot.uganda_confirmed,
        uganda_deaths          : snapshot.uganda_deaths,
        uganda_recovered       : snapshot.uganda_recovered,
        countries_affected     : snapshot.countries_affected,
        health_zones_affected  : snapshot.health_zones_affected,
        source                 : snapshot.source,
        note_suspects          : 'suspected_cases_active = cas suspects ACTIFS du jour (INSP). Pas cumulatif.',
        note_uganda            : 'Uganda: 15 cas (8 Kampala, 1 Wakiso), ≥7 transmission locale, 4 liés voyages RDC. Source: ECDC 04/06/2026.',
        note_provinces         : 'N°020 (03/06): Ituri 341 cas/17ZS, Nord-Kivu 19/7ZS, Sud-Kivu 3/1ZS. Total 25 ZS touchées.',
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
