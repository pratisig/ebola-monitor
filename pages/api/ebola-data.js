/**
 * /api/ebola-data - EBOLA-MONITOR v4.5.4
 *
 * SOURCE PRIMAIRE : INSP RDC PDF quotidiens - https://insp.cd/blog-2/
 * Pattern URL PDF : https://insp.cd/wp-content/uploads/2026/{MM}/SitRep_MVE_RDC_N{NNN}_{JJ}_{MM}_2026*.pdf
 *
 * CHIFFRES CORRECTS - SitRep N017 Revise PDF (01/06/2026) :
 *   - Cas confirmes CUMULES   : 282
 *   - Suspects ACTIFS (j)     : 220  (snapshot journalier, PAS cumulatif)
 *   - Deces confirmes cumules : 42
 *   - Cas actifs confirmes    : 238  (= 282 - 42 - 2)
 *   - Gueris confirmes        : 2
 *   - CFR                     : 14.9% (42/282)
 *   - Taux suivi contacts     : 45.2%
 *   - Zones de sante          : 15
 *
 * NOTE SUSPECTS : INSP publie les suspects ACTIFS du jour (220).
 *   ECDC/WHO publient le CUMUL depuis debut epidemie (>1000).
 *   Ce sont deux methodes differentes, pas des erreurs.
 *
 * CORRECTIONS v4.5.4 :
 *   - Fallback mis a jour avec vrais chiffres PDF INSP N017 revise
 *   - Colonne recovered_estimated = gueris confirmes (2)
 *   - Supabase : ids 1/2/3 invalides, id=4 = source correcte
 *   - Requete Supabase : ORDER BY data_as_of DESC + .neq('parse_confidence','auto_invalid')
 */

import { supabase } from '../../lib/supabase';
import { HISTORICAL_DATA, DRC_HISTORY_BASE, RT_METADATA, RISK_FACTORS_BASE } from '../../lib/historical-data';

// FALLBACK - INSP RDC SitRep N017 Revise - PDF 01/06/2026
const FALLBACK_SNAPSHOT = {
  confirmed_cases         : 282,   // cumul depuis debut epidemie
  suspected_cases         : 220,   // suspects ACTIFS du jour (pas cumulatif)
  confirmed_deaths        : 42,    // cumul depuis debut epidemie
  total_deaths_all        : null,
  cfr_confirmed           : 14.9,  // 42/282 * 100
  recovered_estimated     : 2,     // gueris confirmes
  confirmed_active        : 238,   // = 282 - 42 - 2
  uganda_confirmed        : 9,
  uganda_deaths           : 1,
  countries_affected      : 2,
  health_zones_affected   : 15,
  data_as_of              : '2026-06-01T00:00:00Z',
  source                  : 'INSP RDC SitRep MVE N017 Revise - PDF 01 juin 2026 [SOURCE OFFICIELLE RDC]',
  source_url              : 'https://insp.cd/wp-content/uploads/2026/06/SitRep_MVE_RDC_N017_01_06_2026-Revised_JO_PA_IM-1.pdf',

  contact_tracing: {
    total_contacts_identified : null,
    contact_tracing_rate_pct  : 45.2,
    source                    : 'INSP RDC SitRep N017 Revise',
    source_date               : '2026-06-01',
    source_url                : 'https://insp.cd/wp-content/uploads/2026/06/SitRep_MVE_RDC_N017_01_06_2026-Revised_JO_PA_IM-1.pdf',
  },

  trend: {
    source      : 'INSP RDC SitReps MVE N001-017 PDF officiels',
    source_url  : 'https://insp.cd/blog-2/',
    note        : 'Confirmes = cumules depuis debut. Suspects = actifs du jour (INSP). ECDC suspects = cumul (methode differente).',
    dates            : ['15 mai','17 mai','19 mai','21 mai','23 mai','26 mai','28 mai','01 juin'],
    confirmed        : [8,       10,      22,      31,      101,     121,     125,     282],
    suspected_active : [null,    null,    null,    null,    null,    null,    null,    220],
    suspected_cumul  : [246,     280,     513,     516,     null,    1050,    1077,    null],
    deaths_conf      : [1,       2,       5,       7,       null,    17,      17,      42],
    recovered        : [0,       0,       0,       0,       null,    0,       0,       2],
  },

  provinces: [
    { province:'Ituri',     zone:'Mongbwalu',    cases:null, deaths:null, cfr:null, status:'Active',     country:'DRC',    source:'INSP N017 - detail ZS non publie dans ce fallback', source_date:'2026-06-01' },
    { province:'Ituri',     zone:'Bunia',        cases:null, deaths:null, cfr:null, status:'Active',     country:'DRC',    source:'INSP N017', source_date:'2026-06-01' },
    { province:'Ituri',     zone:'Rwampara',     cases:null, deaths:null, cfr:null, status:'Active',     country:'DRC',    source:'INSP N017', source_date:'2026-06-01' },
    { province:'Ituri',     zone:'Nyakunde',     cases:null, deaths:null, cfr:null, status:'Active',     country:'DRC',    source:'INSP N017', source_date:'2026-06-01' },
    { province:'Ituri',     zone:'Nizi',         cases:null, deaths:null, cfr:null, status:'Active',     country:'DRC',    source:'INSP N017', source_date:'2026-06-01' },
    { province:'Ituri',     zone:'Kilo',         cases:null, deaths:null, cfr:null, status:'Monitoring', country:'DRC',    source:'INSP N017', source_date:'2026-06-01' },
    { province:'Ituri',     zone:'Aru',          cases:null, deaths:null, cfr:null, status:'Monitoring', country:'DRC',    source:'INSP N017', source_date:'2026-06-01' },
    { province:'Nord-Kivu', zone:'Butembo',      cases:null, deaths:null, cfr:null, status:'Active',     country:'DRC',    source:'INSP N017', source_date:'2026-06-01' },
    { province:'Nord-Kivu', zone:'Goma',         cases:null, deaths:null, cfr:null, status:'Monitoring', country:'DRC',    source:'INSP N017', source_date:'2026-06-01' },
    { province:'Nord-Kivu', zone:'Katwa',        cases:null, deaths:null, cfr:null, status:'Monitoring', country:'DRC',    source:'INSP N017', source_date:'2026-06-01' },
    { province:'Nord-Kivu', zone:'Lubero',       cases:null, deaths:null, cfr:null, status:'Monitoring', country:'DRC',    source:'INSP N017', source_date:'2026-06-01' },
    { province:'Nord-Kivu', zone:'Virunga',      cases:null, deaths:null, cfr:null, status:'Monitoring', country:'DRC',    source:'INSP N017', source_date:'2026-06-01' },
    { province:'Sud-Kivu',  zone:'Miti-Murhesa', cases:null, deaths:null, cfr:null, status:'Monitoring', country:'DRC',    source:'INSP N017', source_date:'2026-06-01' },
    { province:'Kinshasa',  zone:'Surveillance', cases:null, deaths:null, cfr:null, status:'Monitoring', country:'DRC',    source:'INSP N017', source_date:'2026-06-01' },
    { province:'Uganda',    zone:'Kampala+',     cases:9,    deaths:1,    cfr:11.1, status:'Monitoring', country:'Uganda', source:'WHO DON603', source_date:'2026-05-20' },
  ],

  sources_comparison: [
    {
      name: 'INSP RDC SitRep N017 Revise (PDF)',
      date: '2026-06-01',
      confirmed_cases: 282, suspected_cases: 220, confirmed_deaths: 42,
      confirmed_active: 238, confirmed_recovered: 2,
      contact_tracing_rate_pct: 45.2,
      note: 'SOURCE OFFICIELLE PRIORITAIRE. 282 cas cumules, 238 actifs, 2 gueris, 42 deces, CFR 14.9%. Suspects=220 ACTIFS du jour (pas cumulatif). Taux suivi contacts: 45.2%.',
      url: 'https://insp.cd/wp-content/uploads/2026/06/SitRep_MVE_RDC_N017_01_06_2026-Revised_JO_PA_IM-1.pdf',
      is_primary: true,
    },
    {
      name: 'INSP RDC SitRep N016',
      date: '2026-05-31',
      confirmed_cases: null, suspected_cases: null, confirmed_deaths: null,
      note: 'Sitrep precedent. PDF: SitRep_MVE_RDC_N016_31_05_2026.pdf',
      url: 'https://insp.cd/wp-content/uploads/2026/05/SitRep_MVE_RDC_N%C2%B0016_31_05_2026.pdf',
    },
    {
      name: 'WHO DON603',
      date: '2026-05-20',
      confirmed_cases: 121, suspected_cases: null, confirmed_deaths: 17,
      note: 'Retard 12 jours sur INSP N017. 121 vs 282 cas (+161). 17 vs 42 deces (+25).',
      url: 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603',
    },
    {
      name: 'ECDC Rapid Risk',
      date: '2026-05-28',
      confirmed_cases: 125, suspected_cases: 1077, confirmed_deaths: 17,
      note: '4 jours retard. ECDC suspects 1077 = CUMUL depuis debut. INSP suspects 220 = ACTIFS du jour. Methodes differentes, pas une erreur.',
      url: 'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda',
    },
    {
      name: 'MSF Briefing',
      date: '2026-05-28',
      confirmed_cases: 125, suspected_cases: 906, confirmed_deaths: 17,
      note: 'Definition suspects terrain restrictive. Retard 4 jours.',
      url: 'https://www.msf.org/ebola-disease-drc-msf-scales-response-rapidly-evolving-outbreak',
    },
  ],

  source_discrepancies: {
    title: 'Pourquoi les chiffres different entre sources ?',
    reasons: [
      { label: 'INSP RDC = source primaire officielle',
        detail: 'PDF quotidiens insp.cd/blog-2. N017 revise (01/06): 282 cas cumules, 42 deces, CFR 14.9%. WHO DON603 (20/05): 121 cas, 17 deces - 12 jours de retard.'
      },
      { label: 'Suspects INSP = actifs du jour (PAS cumulatifs)',
        detail: 'INSP publie suspects ACTIFS en cours investigation = 220 au 01/06. ECDC/WHO publient cumul depuis debut epidemie = 1077+. Deux methodes valides mesurant des choses differentes. Ne pas comparer directement.'
      },
      { label: 'Delai de rapportage',
        detail: 'INSP: quotidien. WHO DON: 10-12 jours. ECDC: 2x/semaine. Auto-parse ECDC errone exclu (parse_confidence=auto_invalid).'
      },
      { label: 'Consolidation INRB',
        detail: 'INSP integre resultats PCR INRB sous 24h. WHO attend validation formelle avant publication DON.'
      },
    ],
    consensus: 'Source retenue: INSP N017 revise PDF (01/06/2026). 282 confirmes cumules, 220 suspects actifs, 42 deces, 2 gueris, 238 actifs, CFR 14.9%, suivi contacts 45.2%.',
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
      suspected_cumul  : trend.suspected_cumul  || trend.suspected_ecdc || [],
      deaths_conf      : trend.deaths_conf      || [],
      recovered        : trend.recovered        || [],
    };
  }

  return {
    confirmed_cases         : raw.confirmed_cases         ?? FALLBACK_SNAPSHOT.confirmed_cases,
    suspected_cases         : raw.suspected_cases         ?? FALLBACK_SNAPSHOT.suspected_cases,
    confirmed_deaths        : raw.confirmed_deaths        ?? FALLBACK_SNAPSHOT.confirmed_deaths,
    total_deaths_all        : raw.total_deaths_all        ?? FALLBACK_SNAPSHOT.total_deaths_all,
    cfr_confirmed           : raw.cfr_confirmed           ?? FALLBACK_SNAPSHOT.cfr_confirmed,
    recovered_estimated     : raw.recovered_estimated     ?? FALLBACK_SNAPSHOT.recovered_estimated,
    confirmed_active        : raw.confirmed_active        ?? (raw.confirmed_cases && raw.confirmed_deaths != null && raw.recovered_estimated != null ? raw.confirmed_cases - raw.confirmed_deaths - raw.recovered_estimated : FALLBACK_SNAPSHOT.confirmed_active),
    uganda_confirmed        : raw.uganda_confirmed        ?? FALLBACK_SNAPSHOT.uganda_confirmed,
    uganda_deaths           : raw.uganda_deaths           ?? FALLBACK_SNAPSHOT.uganda_deaths,
    countries_affected      : raw.countries_affected      ?? FALLBACK_SNAPSHOT.countries_affected,
    health_zones_affected   : raw.health_zones_affected   ?? FALLBACK_SNAPSHOT.health_zones_affected,
    data_as_of              : raw.data_as_of              || FALLBACK_SNAPSHOT.data_as_of,
    source                  : raw.source                  || FALLBACK_SNAPSHOT.source,
    source_url              : raw.source_url              || FALLBACK_SNAPSHOT.source_url,
    created_at              : raw.created_at,
    provinces               : (provinces && Array.isArray(provinces) && provinces.length)                 ? provinces               : FALLBACK_SNAPSHOT.provinces,
    trend                   : normalizedTrend                                                             ? normalizedTrend         : FALLBACK_SNAPSHOT.trend,
    contact_tracing         : (contact_tracing && contact_tracing.contact_tracing_rate_pct != null)      ? contact_tracing         : FALLBACK_SNAPSHOT.contact_tracing,
    sources_comparison      : (sources_comparison && Array.isArray(sources_comparison) && sources_comparison.length) ? sources_comparison : FALLBACK_SNAPSHOT.sources_comparison,
    source_discrepancies    : (source_discrepancies && source_discrepancies.title)                       ? source_discrepancies    : FALLBACK_SNAPSHOT.source_discrepancies,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=14400, stale-while-revalidate=28800');

  let rawSnapshot   = null;
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
    console.warn('[ebola-data] Supabase unavailable:', err.message);
  }

  const snapshot = rawSnapshot ? mergeWithFallback(rawSnapshot) : FALLBACK_SNAPSHOT;

  const confirmedActive = snapshot.confirmed_active
    ?? (snapshot.confirmed_cases - (snapshot.confirmed_deaths || 0) - (snapshot.recovered_estimated || 0));

  const drcHistory = [
    ...DRC_HISTORY_BASE,
    { label: '2026 (en cours)', cases: snapshot.confirmed_cases, deaths: snapshot.confirmed_deaths, cfr: snapshot.cfr_confirmed },
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
    data_source   : supabaseError ? 'FALLBACK_STATIC' : 'Supabase (ORDER BY data_as_of DESC, excl. auto_invalid)',
    primary_source: 'INSP RDC - https://insp.cd/blog-2/',
    supabase_error: supabaseError || null,
    disclaimer    : 'Source primaire: INSP RDC PDF quotidiens (insp.cd/blog-2). Completes par WHO, ECDC, MSF.',
    methodology: {
      primary_source       : 'INSP RDC SitReps MVE PDF quotidiens (insp.cd/blog-2) - source officielle MinSante RDC.',
      secondary_sources    : 'WHO DON, ECDC, MSF, CDC, UNFPA - triangulation et donnees Ouganda.',
      cfr                  : 'CFR = Deces confirmes / Cas confirmes x 100.',
      suspects_insp        : 'INSP publie suspects ACTIFS du jour (snapshot journalier). ECDC/WHO = cumul. Ne pas comparer directement.',
      confirmed_active     : 'Cas actifs = Cas confirmes cumules - Deces confirmes - Gueris confirmes.',
      rt                   : 'Rt estime EpiEstim (Cori 2013). SI BDBV ~7j. IC95%: [1.4-2.1].',
      update_frequency     : 'Veille INSP quotidienne. Cron Vercel 08h00 UTC. parse_confidence=auto_invalid exclus.',
      insp_sitrep_list     : 'https://insp.cd/blog-2/',
      insp_pdf_pattern     : 'https://insp.cd/wp-content/uploads/2026/{MM}/SitRep_MVE_RDC_N{NNN}_{JJ}_{MM}_2026*.pdf',
    },
    outbreak_2026: {
      meta: {
        declaration_date    : '2026-05-15',
        pheic_date          : '2026-05-17',
        virus               : 'Bundibugyo ebolavirus (BDBV)',
        outbreak_number     : 17,
        no_approved_vaccine : true,
        vaccine_in_dev      : 'Africa CDC annonce vaccin BDBV fin 2026 (Dr Jean Kaseya, 28 mai 2026)',
        index_case          : 'Infirmiere, Zone de sante de Mongbwalu, Ituri',
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
        note_suspects         : 'suspected_cases_active = cas suspects ACTIFS du jour (INSP). Pas le cumul depuis debut epidemie.',
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
