/**
 * /api/ebola-data — EBOLA-MONITOR v4.6.0
 *
 * CORRECTIONS v4.6.0 (04/06/2026) :
 *  #2 — Supabase est retenu UNIQUEMENT si data_as_of > fallback statique (2026-06-02)
 *       Sinon le fallback statique (plus récent) est utilisé
 *  #3 — Cache réduit à 1h (était 4h) pour refléter les màj Supabase plus vite
 *
 * SOURCE PRIMAIRE : INSP RDC PDF quotidiens — https://insp.cd/blog-2/
 *
 * DERNIÈRES DONNÉES VÉRIFIÉES (04/06/2026) :
 *  INSP SitRep N°019/MVB_02/2026 (02/06/2026) :
 *   Cas confirmés : 363 | Décès : 62 | CFR : 17.1%
 *   Suspects actifs : 116 | Actifs isolement : 206 | Guéris : 6
 *   Ituri: 335 cas | Nord-Kivu: 22 cas | Sud-Kivu: 6 cas
 *  Uganda (ECDC 03/06/2026) : 15 cas, 1 décès (Kampala 8, Wakiso 1)
 */

import { supabase } from '../../lib/supabase';
import { HISTORICAL_DATA, DRC_HISTORY_BASE, RT_METADATA, RISK_FACTORS_BASE } from '../../lib/historical-data';

// Date du fallback statique — Supabase n'est retenu que si PLUS RÉCENT que cette date
const FALLBACK_STATIC_DATE = '2026-06-02T00:00:00Z';

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
  health_zones_affected   : 24,
  data_as_of              : FALLBACK_STATIC_DATE,
  source                  : 'INSP RDC SitRep MVE N°019/MVB_02/2026 — 02 juin 2026 + ECDC 03/06/2026 [SOURCES OFFICIELLES]',
  source_url              : 'https://insp.cd/blog-2/',

  contact_tracing: {
    suspects_en_investigation  : 116,
    confirmes_actifs_isolement : 206,
    gueris_cumul               : 6,
    contact_tracing_rate_pct   : 45.0,
    contact_tracing_target_pct : 95.0,
    echantillons_positifs_24h  : 19,
    source                     : 'INSP RDC N°019 + ECDC 03/06/2026',
    source_date                : '2026-06-02',
  },

  trend: {
    source      : 'INSP RDC SitReps MVE N°001–019 PDF officiels',
    source_url  : 'https://insp.cd/blog-2/',
    note        : 'Confirmés=cumulés. Suspects=actifs jour J (INSP). +19 nouveaux cas 02 juin.',
    dates            : ['15 mai','17 mai','19 mai','21 mai','23 mai','26 mai','28 mai','01 juin (N017)','01 juin (N018)','02 juin (N019)'],
    confirmed        : [8,       10,      22,      31,      101,     121,     125,     321,             344,             363],
    suspected_active : [null,    null,    null,    null,    null,    null,    null,    104,             116,             116],
    deaths_conf      : [1,       2,       5,       7,       null,    17,      17,      48,              60,              62],
    recovered        : [0,       0,       0,       0,       null,    0,       0,       6,               6,               6],
    new_cases_24h    : [null,    null,    null,    null,    null,    null,    null,    12,              23,              19],
  },

  provinces: [
    { province:'Ituri',     cases:335, deaths:58, cfr:17.3, zones_touchees:16, new_cases_24h:17, country:'DRC',    source:'INSP N°019', source_date:'2026-06-02',
      zones:['Aru','Aungba','Bambu','Bunia','Damas','Gety','Kilo','Komanda','Lita','Logo','Mangala','Mongbwalu','Nizi','Nyankunde','Rwampara','Fataki'] },
    { province:'Nord-Kivu', cases:22,  deaths:3,  cfr:13.6, zones_touchees:7,  new_cases_24h:2,  country:'DRC',    source:'INSP N°019', source_date:'2026-06-02',
      zones:['Beni','Butembo','Goma','Kalunguta','Katwa','Kyondo','Oicha'] },
    { province:'Sud-Kivu',  cases:6,   deaths:1,  cfr:16.7, zones_touchees:1,  new_cases_24h:0,  country:'DRC',    source:'INSP N°019', source_date:'2026-06-02',
      zones:['Miti-Murhesa'] },
    { province:'Uganda',    cases:15,  deaths:1,  cfr:6.7,  zones_touchees:2,  country:'Uganda', source:'ECDC 03/06/2026', source_date:'2026-06-03',
      zones:['Kampala (8 cas)','Wakiso (1 cas)'] },
  ],

  sources_comparison: [
    {
      name:'INSP RDC SitRep N°019/MVB_02 (source officielle)',
      date:'2026-06-02', confirmed_cases:363, suspected_cases:116, confirmed_deaths:62,
      confirmed_active:206, confirmed_recovered:6, contact_tracing_rate_pct:45.0, health_zones:24, new_cases_24h:19,
      note:'SOURCE OFFICIELLE RDC. 363 cas cumulés (+19 le 02/06), 206 actifs/isolement, 116 suspects actifs, 6 guéris, 62 décès, CFR 17.1%.',
      url:'https://insp.cd/blog-2/', is_primary:true,
    },
    {
      name:'ECDC (mis à jour 03 juin 13h30 UTC)',
      date:'2026-06-03', confirmed_cases:344, confirmed_deaths:60, suspected_cases:116,
      note:'Réf. SitRep N°018 (01/06) — 1j retard. Uganda: 15 cas (8 Kampala, 1 Wakiso), 1 décès, ≥7 transmission locale.',
      url:'https://www.ecdc.europa.eu/en/ebola-outbreak-democratic-republic-congo-and-uganda',
    },
  ],

  source_discrepancies: {
    title: 'Pourquoi les chiffres diffèrent entre sources ?',
    reasons: [
      { label:'INSP N°019 = source primaire temps réel (02/06)',
        detail:'363 cas, 62 décès, CFR 17.1%. WHO/ECDC (03/06): 344 cas, 60 décès — basé sur N°018 (01/06), 1 jour de retard.' },
      { label:'Suspects INSP = actifs du jour (PAS cumulatifs)',
        detail:'INSP: 116 suspects actifs en investigation. Ne pas comparer avec les cumuls WHO/ECDC.' },
      { label:'Uganda — transmission locale confirmée (ECDC 03/06)',
        detail:'15 cas Uganda: ≥7 transmission locale, 4 liés à voyages RDC. 8 cas Kampala, 1 Wakiso. 1 décès.' },
    ],
    consensus: 'Source retenue: INSP N°019 (02/06) pour DRC + ECDC 03/06 pour Uganda. DRC: 363 confirmés, 62 décès, CFR 17.1%.',
  },
};

function parseField(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return null; } }
  return val;
}

/**
 * FIX #2 — Supabase est retenu UNIQUEMENT si sa date est strictement postérieure au fallback.
 * Évite qu'un row Supabase ancien (N°017) écrase un fallback statique plus récent (N°019).
 */
function shouldUseSupabase(rawDataAsOf) {
  if (!rawDataAsOf) return false;
  const supabaseDate = new Date(rawDataAsOf);
  const fallbackDate = new Date(FALLBACK_STATIC_DATE);
  return supabaseDate > fallbackDate;
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
  // FIX #5 — Cache réduit à 1h (était 4h) pour refléter les màj Supabase plus vite
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

    // FIX #2 — N'utiliser Supabase que si plus récent que le fallback statique
    if (data && shouldUseSupabase(data.data_as_of)) {
      rawSnapshot = data;
    } else {
      supabaseSkipped = true;
      supabaseError = `Supabase data (${data?.data_as_of}) not newer than fallback (${FALLBACK_STATIC_DATE}) — using static fallback`;
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
    { year:2026, country:'Uganda', cases:snapshot.uganda_confirmed, deaths:snapshot.uganda_deaths, cfr: snapshot.uganda_confirmed ? parseFloat(((snapshot.uganda_deaths/snapshot.uganda_confirmed)*100).toFixed(1)) : 0, species:'Bundibugyo', status:'Ongoing' },
  ];

  res.status(200).json({
    success       : true,
    generated_at  : new Date().toISOString(),
    data_as_of    : snapshot.data_as_of,
    data_source   : rawSnapshot ? 'Supabase' : (supabaseSkipped ? 'FALLBACK_STATIC (Supabase older than fallback)' : 'FALLBACK_STATIC (Supabase error)'),
    primary_source: 'INSP RDC — https://insp.cd/blog-2/',
    supabase_error: supabaseError || null,
    automation    : {
      edge_function : 'insp-scraper v2',
      cron          : '0 8,14 * * * UTC',
      fallback_levels: ['INSP WordPress API','ReliefWeb API','static fallback'],
    },
    disclaimer    : 'Source primaire: INSP RDC PDF quotidiens (insp.cd/blog-2/). Complété par WHO, ECDC.',
    methodology: {
      primary_source    : 'INSP RDC SitReps MVE PDF quotidiens (insp.cd/blog-2/).',
      secondary_source  : 'ECDC (03/06/2026 13h30 UTC) pour Uganda.',
      suspects_insp     : 'suspected_cases = suspects ACTIFS du jour (INSP). PAS cumulatif.',
      confirmed_active  : 'confirmed_active = hospitalisés/isolement (INSP N°019).',
      cfr               : 'CFR = Décès confirmés / Cas confirmés × 100.',
      fallback_static_date: FALLBACK_STATIC_DATE,
      supabase_priority : 'Supabase retenu uniquement si data_as_of > fallback_static_date (FIX #2)',
      cache_ttl         : '3600s (1h) — FIX #5',
      last_checked      : '2026-06-04T12:00:00Z',
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
        next_sitrep_expected: '2026-06-04',
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
        uganda_recovered      : snapshot.uganda_recovered,
        countries_affected    : snapshot.countries_affected,
        health_zones_affected : snapshot.health_zones_affected,
        source                : snapshot.source,
        note_suspects         : 'suspected_cases_active = cas suspects ACTIFS du jour (INSP). Pas cumulatif.',
        note_uganda           : 'Uganda: 15 cas (8 Kampala, 1 Wakiso), ≥7 transmission locale, 4 liés voyages RDC. Source: ECDC 03/06/2026.',
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
