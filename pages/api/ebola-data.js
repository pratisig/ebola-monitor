/**
 * /api/ebola-data — EBOLA-MONITOR v4.6.2
 *
 * CHANGELOG v4.6.2 (05/06/2026) — CORRECTION DONNÉES N°020 PDF OFFICIEL :
 *  Corrections par rapport à v4.6.1 (données erronées) :
 *   confirmed_cases    : 363 → 381 (+18 nouveaux cas 03/06)
 *   confirmed_deaths   : 62  → 64  (+2 décès 03/06)
 *   cfr_confirmed      : 17.1 → 16.8%
 *   new_cases_24h      : 0   → 18
 *   Ituri cas          : 341 → 359 | décès: 59 → 50 | CFR: 17.3 → 13.9% | ZS: 16 → 17
 *   Nord-Kivu décès   : 2   → 13  | CFR: 10.5 → 68.4%
 *   confirmed_active   : 206 → 233 (patients en isolement/hosp fin J)
 *   recovered_estimated: 6   → 7   (sortie gueri Goma 03/06)
 *   suspected_cases    : 116 → 171 (suspects en isolement)
 *   contact_tracing_rate: 45.0 → 55.5% (4 551 contacts, 2 525 vus)
 *   fallback guard     : < 363 → < 381
 *   FALLBACK_STATIC_DATE: 2026-06-03 (inchangé)
 *   sources_comparison  : INSP N°020 mise à jour chiffres corrects
 *   note_provinces     : mise à jour
 *  Source vérifiée : Draft-2-SitRep_MVE_RDC_N20_02_06_2026-_JO_PA-FINAL.pdf
 *
 * CHANGELOG v4.6.1 (05/06/2026) :
 *  - provinces N°020, 5 sources WHO, fallback guard, cache 1h
 *
 * CHANGELOG v4.6.0 (04/06/2026) :
 *  #2 — Supabase retenu UNIQUEMENT si data_as_of > fallback statique
 *  #5 — Cache réduit à 1h
 *
 * SOURCE PRIMAIRE : INSP RDC PDF quotidiens — https://insp.cd/blog-2/
 *
 * DERNIÈRES DONNÉES VÉRIFIÉES — INSP SitRep N°020 (rapportage 03/06/2026, publié 04/06) :
 *  Cas confirmés : 381 | Décès : 64 | CFR : 16.8% | Nouveaux 24h : 18
 *  Ituri   : 359 cas, 50 décès, CFR 13.9%, 17/36 ZS, +18 cas 24h
 *  Nord-Kivu: 19 cas, 13 décès, CFR 68.4%, 7/34 ZS, +0 cas 24h
 *  Sud-Kivu :  3 cas,  1 décès, CFR 33.3%, 1/34 ZS, +0 cas 24h
 *  Total ZS : 25/104 (24.0%)
 *  Patients en isolement : 233 (dont 62 confirmés, 171 suspects)
 *  Guéris cumulés : 7 | Taux suivi contacts : 55.5% (4 551 / 2 525 vus)
 *  Uganda (ECDC 04/06/2026) : 15 cas, 1 décès
 */

import { supabase } from '../../lib/supabase';
import { HISTORICAL_DATA, DRC_HISTORY_BASE, RT_METADATA, RISK_FACTORS_BASE } from '../../lib/historical-data';

// Date du fallback statique — Supabase n'est retenu que si PLUS RÉCENT que cette date
const FALLBACK_STATIC_DATE = '2026-06-03T00:00:00Z';

const FALLBACK_SNAPSHOT = {
  confirmed_cases         : 381,
  suspected_cases         : 171,   // suspects en isolement (N°020 tableau prise en charge)
  confirmed_deaths        : 64,
  total_deaths_all        : null,
  cfr_confirmed           : 16.8,
  recovered_estimated     : 7,
  confirmed_active        : 233,   // patients en isolement fin J (62 confirmés + 171 suspects)
  uganda_confirmed        : 15,
  uganda_deaths           : 1,
  uganda_recovered        : 0,
  countries_affected      : 2,
  health_zones_affected   : 25,
  data_as_of              : FALLBACK_STATIC_DATE,
  source                  : 'INSP RDC SitRep MVE N°020/MVB_02/2026 — 03 juin 2026 + ECDC 04/06/2026 [SOURCES OFFICIELLES]',
  source_url              : 'https://insp.cd/blog-2/',

  contact_tracing: {
    suspects_en_investigation  : 171,
    confirmes_actifs_isolement : 62,
    total_en_isolement         : 233,
    gueris_cumul               : 7,
    contact_tracing_rate_pct   : 55.5,
    contact_tracing_target_pct : 95.0,
    contacts_sous_suivi        : 4551,
    contacts_vus_24h           : 2525,
    echantillons_positifs_24h  : 18,
    echantillons_analyses_24h  : 82,
    taux_positivite_labo       : 22.0,
    source                     : 'INSP RDC N°020 + ECDC 04/06/2026',
    source_date                : '2026-06-03',
    detail_provinces: {
      ituri    : { contacts: 3837, vus_24h: 2032, taux: 53.0 },
      nord_kivu: { contacts: 533,  vus_24h: 343,  taux: 64.4 },
      sud_kivu : { contacts: 181,  vus_24h: 150,  taux: 82.9 },
    },
  },

  trend: {
    source      : 'INSP RDC SitReps MVE N°001–020 PDF officiels',
    source_url  : 'https://insp.cd/blog-2/',
    note        : 'Confirmés=cumulés. Suspects=en isolement fin J (N°020: 171). +18 nouveaux cas 03/06 (Bunia 12, Rwampara 4, Damas 1, Lita 1).',
    dates            : ['15 mai','17 mai','19 mai','21 mai','23 mai','26 mai','28 mai','01 juin (N017)','01 juin (N018)','02 juin (N019)','03 juin (N020)'],
    confirmed        : [8,       10,      22,      31,      101,     121,     125,     321,             344,             363,             381],
    suspected_active : [null,    null,    null,    null,    null,    null,    null,    104,             116,             116,             171],
    deaths_conf      : [1,       2,       5,       7,       null,    17,      17,      48,              60,              62,              64],
    recovered        : [0,       0,       0,       0,       null,    0,       0,       6,               6,               7,               7],
    new_cases_24h    : [null,    null,    null,    null,    null,    null,    null,    12,              23,              19,              18],
  },

  provinces: [
    {
      province      : 'Ituri',
      cases         : 359,
      deaths        : 50,
      cfr           : 13.9,
      zones_touchees: 17,
      new_cases_24h : 18,
      country       : 'DRC',
      source        : 'INSP N°020',
      source_date   : '2026-06-03',
      epicentre     : true,
      pct_total_cases: 94.2,
      zones: ['Aru','Aungba','Bambu','Bunia','Damas','Gety','Kilo','Komanda','Lita','Logo','Mambasa','Mangala','Mongbwalu','Nizi','Nyankunde','Rimba','Rwampara'],
      zones_detail: [
        { zone:'Bunia',     cases:97, deaths:9,  cfr:9.3  },
        { zone:'Rwampara',  cases:76, deaths:16, cfr:21.1 },
        { zone:'Mongbwalu', cases:47, deaths:10, cfr:21.3 },
        { zone:'Nyankunde', cases:22, deaths:1,  cfr:4.5  },
        { zone:'Rimba',     cases:3,  deaths:0,  cfr:0.0  },
        { zone:'Damas',     cases:3,  deaths:0,  cfr:0.0  },
        { zone:'Lita',      cases:2,  deaths:0,  cfr:0.0  },
        { zone:'Bambu',     cases:2,  deaths:2,  cfr:100  },
        { zone:'Aru',       cases:2,  deaths:1,  cfr:50.0 },
        { zone:'Kilo',      cases:2,  deaths:0,  cfr:0.0  },
        { zone:'Mambasa',   cases:2,  deaths:1,  cfr:50.0 },
        { zone:'Nizi',      cases:2,  deaths:0,  cfr:0.0  },
        { zone:'Mangala',   cases:1,  deaths:0,  cfr:0.0  },
        { zone:'Aungba',    cases:1,  deaths:0,  cfr:0.0  },
        { zone:'Gety',      cases:1,  deaths:0,  cfr:0.0  },
        { zone:'Komanda',   cases:1,  deaths:0,  cfr:0.0  },
        { zone:'Logo',      cases:1,  deaths:0,  cfr:0.0  },
        { zone:'Autres (non ventilées)', cases:94, deaths:10, cfr:10.6 },
      ],
    },
    {
      province      : 'Nord-Kivu',
      cases         : 19,
      deaths        : 13,
      cfr           : 68.4,
      zones_touchees: 7,
      new_cases_24h : 0,
      country       : 'DRC',
      source        : 'INSP N°020',
      source_date   : '2026-06-03',
      note          : 'Létalité 68.4% expliquée par retards de prise en charge et évasions. Activités paralysées à Beni/Butembo/Oicha (massacres ADF).',
      zones: ['Beni','Butembo','Goma','Kalunguta','Katwa','Kyondo','Oicha'],
      zones_detail: [
        { zone:'Katwa',     cases:7, deaths:5, cfr:71.4 },
        { zone:'Beni',      cases:5, deaths:3, cfr:60.0 },
        { zone:'Butembo',   cases:2, deaths:2, cfr:100  },
        { zone:'Oicha',     cases:2, deaths:2, cfr:100  },
        { zone:'Kalunguta', cases:1, deaths:1, cfr:100  },
        { zone:'Kyondo',    cases:1, deaths:0, cfr:0.0  },
        { zone:'Goma',      cases:1, deaths:0, cfr:0.0  },
      ],
    },
    {
      province      : 'Sud-Kivu',
      cases         : 3,
      deaths        : 1,
      cfr           : 33.3,
      zones_touchees: 1,
      new_cases_24h : 0,
      country       : 'DRC',
      source        : 'INSP N°020',
      source_date   : '2026-06-03',
      zones: ['Miti-Murhesa'],
      zones_detail: [
        { zone:'Miti-Murhesa', cases:3, deaths:1, cfr:33.3 },
      ],
    },
    {
      province      : 'Uganda',
      cases         : 15,
      deaths        : 1,
      cfr           : 6.7,
      zones_touchees: 2,
      new_cases_24h : null,
      country       : 'Uganda',
      source        : 'ECDC 04/06/2026',
      source_date   : '2026-06-04',
      zones: ['Kampala (8 cas)','Wakiso (1 cas)'],
      note: '15 cas dont ≥7 transmission locale, 4 liés à voyages RDC.',
    },
  ],

  sources_comparison: [
    {
      name            : 'INSP RDC SitRep N°020/MVB_02/2026 (source officielle)',
      date            : '2026-06-03',
      confirmed_cases : 381,
      suspected_cases : 171,
      confirmed_deaths: 64,
      confirmed_active: 233,
      confirmed_recovered: 7,
      contact_tracing_rate_pct: 55.5,
      health_zones    : 25,
      new_cases_24h   : 18,
      note            : 'SOURCE OFFICIELLE RDC (rapportage 03/06, publié 04/06). 381 cas cumulés (+18 le 03/06: Bunia 12, Rwampara 4, Damas 1, Lita 1), 64 décès, CFR 16.8%, 25 ZS. 233 patients en isolement (62 confirmés + 171 suspects). 7 guéris. Suivi contacts 55.5% (4 551 contacts, cible 95%).',
      url             : 'https://insp.cd/blog-2/',
      is_primary      : true,
    },
    {
      name            : 'WHO 03/06/2026',
      date            : '2026-06-03',
      confirmed_cases : 344,
      confirmed_deaths: 60,
      note            : 'WHO: réf. N°018 (01/06), 2j retard. 381 vs 344 = +37 cas non encore rapportés par WHO. Uganda: 15 cas, 1 décès.',
      url             : 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603',
    },
    {
      name            : 'WHO / Le Monde 02/06/2026',
      date            : '2026-06-02',
      confirmed_cases : 344,
      confirmed_deaths: 60,
      note            : 'WHO cité par Le Monde 02/06: 344 cas, 60 décès. Basé sur N°018 (01/06) — retard rapportage WHO.',
      url             : 'https://www.lemonde.fr/afrique/article/2026/06/02/ebola-en-rdc',
    },
    {
      name            : 'ECDC (mis à jour 04 juin 2026)',
      date            : '2026-06-04',
      confirmed_cases : 363,
      confirmed_deaths: 62,
      suspected_cases : 116,
      note            : 'ECDC réf. N°019 (02/06), 1j retard vs N°020. Uganda: 15 cas (8 Kampala, 1 Wakiso), 1 décès, ≥7 transmission locale.',
      url             : 'https://www.ecdc.europa.eu/en/ebola-outbreak-democratic-republic-congo-and-uganda',
    },
    {
      name            : 'WHO DON603 (historique)',
      date            : '2026-05-20',
      confirmed_cases : 121,
      confirmed_deaths: 17,
      note            : 'Retard historique 12j. Données primaires remplacées par INSP N°020.',
      url             : 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603',
    },
  ],

  source_discrepancies: {
    title: 'Pourquoi les chiffres diffèrent entre sources ?',
    reasons: [
      { label: 'INSP N°020 = source primaire temps réel (03/06)',
        detail: '381 cas, 64 décès, CFR 16.8%, 25 ZS. WHO (03/06): 344 cas (réf. N°018, 2j retard). ECDC (04/06): 363 cas (réf. N°019, 1j retard).' },
      { label: 'Suspects INSP = en isolement fin J (PAS cumulatifs)',
        detail: 'INSP N°020: 171 suspects en isolement (tableau prise en charge). 233 total en isolement (62 confirmés + 171 suspects). Ne pas comparer avec cumuls WHO/ECDC.' },
      { label: 'Nord-Kivu : létalité 68.4% — cas critiques hors CTE',
        detail: '19 cas, 13 décès. CFR élevé expliqué par retards de prise en charge et évasions de CTE. Activités paralysées (massacres ADF à Mbau/Oicha).' },
      { label: 'Uganda — transmission locale confirmée (ECDC 04/06)',
        detail: '15 cas: ≥7 transmission locale, 4 liés voyages RDC. 8 cas Kampala, 1 Wakiso. 1 décès.' },
      { label: 'Délai rapportage',
        detail: 'INSP: quotidien. WHO: 1-3j retard. ECDC: 2-3×/semaine. Source retenue: INSP N°020 (03/06).' },
    ],
    consensus: 'Source retenue: INSP N°020 (03/06) pour DRC + ECDC 04/06 pour Uganda. DRC: 381 confirmés (+18), 171 suspects en isolement, 64 décès, 7 guéris, CFR 16.8%, 25 ZS. Uganda: 15 cas, 1 décès.',
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
 * Fallback guard : rejette Supabase si les données régressent vs baseline N°020
 */
function isSupabaseDataSane(raw) {
  if (!raw.confirmed_cases || raw.confirmed_cases < 381) return false;  // baseline N°020
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
      supabaseError = `Supabase row skipped: date=${data?.data_as_of}, cases=${data?.confirmed_cases} — not newer/sane vs fallback (${FALLBACK_STATIC_DATE}, baseline 381 cas)`;
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
      suspects_insp        : 'suspected_cases = suspects EN ISOLEMENT fin J (INSP N°020 tableau prise en charge). PAS cumulatif.',
      confirmed_active     : 'confirmed_active = total patients en isolement/hosp fin J (confirmés + suspects, INSP N°020).',
      cfr                  : 'CFR = Décès confirmés / Cas confirmés × 100.',
      fallback_static_date : FALLBACK_STATIC_DATE,
      fallback_guard       : 'Supabase rejeté si cases < 381 (baseline N°020) ou CFR > 80%',
      supabase_priority    : 'Supabase retenu si data_as_of > fallback_static_date ET données saines',
      cache_ttl            : '3600s (1h)',
      last_checked         : '2026-06-05T15:18:00Z',
      source_pdf           : 'Draft-2-SitRep_MVE_RDC_N20_02_06_2026-_JO_PA-FINAL.pdf',
    },
    outbreak_2026: {
      meta: {
        declaration_date    : '2026-05-15',
        pheic_date          : '2026-05-17',
        virus               : 'Bundibugyo ebolavirus (BDBV)',
        outbreak_number     : 17,
        no_approved_vaccine : true,
        index_case          : 'Zone de santé de Mongbwalu, Ituri (présumé)',
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
        note_suspects          : 'suspected_cases_active = suspects EN ISOLEMENT fin J (INSP N°020). 233 total en isolement = 62 confirmés + 171 suspects.',
        note_uganda            : 'Uganda: 15 cas (8 Kampala, 1 Wakiso), ≥7 transmission locale, 4 liés voyages RDC. Source: ECDC 04/06/2026.',
        note_provinces         : 'N°020 (03/06): Ituri 359/13.9%/17ZS (+18), Nord-Kivu 19/68.4%/7ZS, Sud-Kivu 3/33.3%/1ZS. Ituri = 94.2% des cas.',
        note_nk_cfr            : 'Nord-Kivu CFR 68.4% (13/19): retards prise en charge + évasions CTE + sécurité ADF.',
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
