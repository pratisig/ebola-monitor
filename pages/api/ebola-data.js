/**
 * /api/ebola-data — EBOLA-MONITOR v4.5.2
 *
 * Source primaire : INSP RDC — https://insp.cd/blog-2/
 * SitRep le plus récent : N°017 — https://insp.cd/sitrep-n017-mvb_31-2026/
 * Pattern URL : https://insp.cd/sitrep-n{NNN}-mvb_{JJ}-2026/
 *
 * Données confirmées croisées :
 *   - INSP Facebook SE20 : "cas confirmés et 38 décès rapportés"
 *   - ReliefWeb SitRep N°009 (23 mai) : 94+6+1 = 101 confirmés
 *   - OMS ONU News (19 mai) : "~600 suspects, 139 décès suspects"
 *   - BBC Afrique (19 mai) : "131 morts, 513 suspects"
 */

import { supabase } from '../../lib/supabase';
import { HISTORICAL_DATA, DRC_HISTORY_BASE, RT_METADATA, RISK_FACTORS_BASE } from '../../lib/historical-data';

const FALLBACK_SNAPSHOT = {
  confirmed_cases: 143,
  suspected_cases: 1103,
  confirmed_deaths: 38,
  total_deaths_all: 280,
  cfr_confirmed: 26.6,
  recovered_estimated: 61,
  uganda_confirmed: 9,
  uganda_deaths: 1,
  countries_affected: 2,
  health_zones_affected: 15,
  data_as_of: '2026-05-31T00:00:00Z',
  source: 'INSP RDC SitRep MVE N°017 (31 mai 2026) — SOURCE OFFICIELLE RDC',

  sources_comparison: [
    {
      name: 'INSP RDC SitRep N°017',
      date: '2026-05-31',
      confirmed_cases: 143,
      suspected_cases: 1103,
      confirmed_deaths: 38,
      total_deaths: 280,
      note: 'Source officielle MinSanté RDC. Données les plus récentes et les plus détaillées par zone de santé. CFR 26.6%.',
      url: 'https://insp.cd/sitrep-n017-mvb_31-2026/',
      is_primary: true,
    },
    {
      name: 'INSP RDC (Facebook SE20)',
      date: '2026-05-31',
      confirmed_cases: null,
      suspected_cases: null,
      confirmed_deaths: 38,
      total_deaths: null,
      note: '"Cas confirmés et 38 décès rapportés à la SE20-2026" — confirme les décès du SitRep N°017.',
      url: 'https://www.facebook.com/p/Institut-National-de-Sant%C3%A9-Publique-RDC-61559707004812/',
    },
    {
      name: 'WHO DON603',
      date: '2026-05-20',
      confirmed_cases: 121,
      suspected_cases: null,
      confirmed_deaths: 17,
      total_deaths: 223,
      note: 'Dernier DON officiel WHO. Retard ~11j sur INSP N°017. Décès sous-estimés (17 vs 38 INSP).',
      url: 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603',
    },
    {
      name: 'ECDC Rapid Risk',
      date: '2026-05-28',
      confirmed_cases: 125,
      suspected_cases: 1077,
      confirmed_deaths: 17,
      total_deaths: 238,
      note: 'ECDC agrège WHO + MinSanté RDC. 3 jours de retard. Décès 17 confirmés vs 38 INSP.',
      url: 'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda',
    },
    {
      name: 'MSF Briefing',
      date: '2026-05-28',
      confirmed_cases: 125,
      suspected_cases: 906,
      confirmed_deaths: 17,
      total_deaths: 223,
      note: 'Définition cas terrain restrictive → 906 suspects (vs 1103 INSP). Décès sous-comptés.',
      url: 'https://www.msf.org/ebola-disease-drc-msf-scales-response-rapidly-evolving-outbreak',
    },
    {
      name: 'OMS/ONU News',
      date: '2026-05-19',
      confirmed_cases: 51,
      suspected_cases: 600,
      confirmed_deaths: null,
      total_deaths: 139,
      note: 'Chiffres au 19 mai. Épicentre Ituri + Nord-Kivu. Risque épidémique élevé national et régional.',
      url: 'https://news.un.org/fr/story/2026/05/1158865',
    },
    {
      name: 'CDC Situation Summary',
      date: '2026-05-29',
      confirmed_cases: 125,
      suspected_cases: null,
      confirmed_deaths: 17,
      total_deaths: null,
      note: 'Reprend chiffres WHO confirmés uniquement.',
      url: 'https://www.cdc.gov/ebola/situation-summary/index.html',
    },
    {
      name: 'UNFPA Flash Update',
      date: '2026-05-27',
      confirmed_cases: 121,
      suspected_cases: 1012,
      confirmed_deaths: 17,
      total_deaths: 240,
      note: 'Rapport au 26 mai. Base sitreps INSP antérieurs.',
      url: 'https://www.unfpa.org/resources/unfpa-flash-update-bundibugyo-ebola-virus-disease-bvd-outbreak-20-26-may-2026',
    },
  ],

  source_discrepancies: {
    title: 'Pourquoi les chiffres diffèrent entre sources ?',
    reasons: [
      {
        label: 'INSP RDC = source primaire officielle',
        detail: 'L’INSP publie quotidiennement les sitreps officiels du MinSanté RDC (insp.cd/blog-2). WHO/ECDC les répliquent avec 3–11 jours de retard. Écart actuel décès : 38 (INSP N°017) vs 17 (WHO DON603 du 20 mai).',
      },
      {
        label: 'Définition de cas suspect',
        detail: 'INSP/WHO/ECDC : fièvre + symptôme hémorragique → 1103 suspects. MSF terrain : fièvre + contact + symptômes → 906 suspects. Différence de 197 suspects.',
      },
      {
        label: 'Délai de rapportage',
        detail: 'INSP publie quotidiennement. WHO DON tous les ~10 jours. ECDC 2x/semaine. Résultat : écart de 21 décès confirmés entre INSP (38) et WHO (17 au 20 mai).',
      },
      {
        label: 'Consolidation laboratoire INRB',
        detail: 'INSP intègre les résultats PCR de l’INRB (Institut National de Recherche Biomédicale) sous 24h. WHO attend confirmation officielle avant publication DON.',
      },
      {
        label: 'Accès terrain limité',
        detail: 'Conflit armé actif Nord-Kivu/Sud-Kivu. Zones isolées rapportent avec retard vers INSP, puis vers WHO.',
      },
    ],
    consensus: 'Source retenue : INSP RDC SitRep N°017 (31 mai) : 143 confirmés, 1103 suspects, 38 décès confirmés, CFR 26.6%. WHO DON603 et ECDC 28 mai reflètent l’état au 20–28 mai uniquement.',
  },

  provinces: [
    // Source : INSP SitRep N°009 (23 mai) = 94 Ituri + 6 Nord-Kivu + 1 Sud-Kivu = 101 confirmés
    // Source : INSP SitRep N°017 (31 mai) = 143 confirmés totaux, 38 décès
    { province: 'Ituri',     zone: 'Mongbwalu',     cases: 65, deaths: 18, cfr: 27.7, status: 'Active',     country: 'DRC',    source: 'INSP N°017', source_date: '2026-05-31' },
    { province: 'Ituri',     zone: 'Bunia',         cases: 38, deaths: 11, cfr: 28.9, status: 'Active',     country: 'DRC',    source: 'INSP N°017', source_date: '2026-05-31' },
    { province: 'Ituri',     zone: 'Rwampara',      cases: 20, deaths:  5, cfr: 25.0, status: 'Active',     country: 'DRC',    source: 'INSP N°017', source_date: '2026-05-31' },
    { province: 'Ituri',     zone: 'Nyakunde',      cases:  5, deaths:  1, cfr: 20.0, status: 'Active',     country: 'DRC',    source: 'INSP N°017', source_date: '2026-05-31' },
    { province: 'Ituri',     zone: 'Nizi',          cases:  4, deaths:  1, cfr: 25.0, status: 'Active',     country: 'DRC',    source: 'INSP N°009', source_date: '2026-05-23' },
    { province: 'Nord-Kivu', zone: 'Butembo',       cases: 10, deaths:  2, cfr: 20.0, status: 'Active',     country: 'DRC',    source: 'INSP N°017', source_date: '2026-05-31' },
    { province: 'Nord-Kivu', zone: 'Goma',          cases:  5, deaths:  0, cfr:  0.0, status: 'Monitoring', country: 'DRC',    source: 'INSP N°017', source_date: '2026-05-31' },
    { province: 'Nord-Kivu', zone: 'Katwa',         cases:  2, deaths:  0, cfr:  0.0, status: 'Monitoring', country: 'DRC',    source: 'INSP N°009', source_date: '2026-05-23' },
    { province: 'Sud-Kivu',  zone: 'Miti-Murhesa',  cases:  4, deaths:  0, cfr:  0.0, status: 'Monitoring', country: 'DRC',    source: 'INSP N°017', source_date: '2026-05-31' },
    { province: 'Kinshasa',  zone: 'Surveillance',  cases:  2, deaths:  0, cfr:  0.0, status: 'Monitoring', country: 'DRC',    source: 'INSP N°017', source_date: '2026-05-31' },
    { province: 'Maniema',   zone: 'Surveillance',  cases:  1, deaths:  0, cfr:  0.0, status: 'Monitoring', country: 'DRC',    source: 'INSP N°017', source_date: '2026-05-31' },
    { province: 'Uganda',    zone: 'Kampala+',      cases:  9, deaths:  1, cfr: 11.1, status: 'Monitoring', country: 'Uganda', source: 'WHO DON603',  source_date: '2026-05-20' },
  ],

  trend: {
    source: 'INSP RDC SitReps MVE N°001–017 + WHO DON601-603 + ECDC + UNFPA',
    source_url: 'https://insp.cd/blog-2/',
    note: 'Suspects INSP (1103 au 31 mai) vs MSF terrain (906 au 28 mai). Décès INSP (38) vs WHO DON (17 au 20 mai). Source primaire : INSP RDC.',
    dates:          ['15 mai', '16 mai', '17 mai', '18 mai', '19 mai', '21 mai', '22 mai', '23 mai', '24 mai', '26 mai', '28 mai', '29 mai', '31 mai'],
    confirmed:      [8,        8,        10,       13,       22,       31,       40,       101,      51,       70,       121,      125,      143    ],
    suspected_ecdc: [246,      248,      280,      300,      513,      516,      650,      null,     800,      1012,     1077,     1077,     1103   ],
    suspected_msf:  [null,     null,     null,     null,     null,     null,     null,     null,     null,     null,     906,      906,      null   ],
    deaths_conf:    [1,        1,        2,        3,        5,        7,        10,       null,     14,       16,       17,       17,       38     ],
    deaths_all:     [40,       42,       55,       80,       131,      160,      195,      null,     220,      238,      246,      246,      280    ],
  },

  contact_tracing: {
    total_contacts_identified: 712,
    drc_contacts: 581,
    uganda_contacts: 131,
    source: 'INSP RDC SitRep N°017 + WHO',
    source_date: '2026-05-31',
    source_url: 'https://insp.cd/sitrep-n017-mvb_31-2026/',
  },
};

function parseField(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch (e) { return null; }
  }
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
    const ecdc = trend.suspected_ecdc || trend.suspected || [];
    const msf  = trend.suspected_msf  || [];
    normalizedTrend = {
      source:         trend.source     || FALLBACK_SNAPSHOT.trend.source,
      source_url:     trend.source_url || FALLBACK_SNAPSHOT.trend.source_url,
      note:           trend.note       || FALLBACK_SNAPSHOT.trend.note,
      dates:          trend.dates,
      confirmed:      trend.confirmed      || [],
      suspected_ecdc: ecdc,
      suspected_msf:  msf,
      deaths_conf:    trend.deaths_conf    || [],
      deaths_all:     trend.deaths_all     || [],
    };
  }

  return {
    confirmed_cases:       raw.confirmed_cases       ?? FALLBACK_SNAPSHOT.confirmed_cases,
    suspected_cases:       raw.suspected_cases       ?? FALLBACK_SNAPSHOT.suspected_cases,
    confirmed_deaths:      raw.confirmed_deaths      ?? FALLBACK_SNAPSHOT.confirmed_deaths,
    total_deaths_all:      raw.total_deaths_all      ?? FALLBACK_SNAPSHOT.total_deaths_all,
    cfr_confirmed:         raw.cfr_confirmed         ?? FALLBACK_SNAPSHOT.cfr_confirmed,
    recovered_estimated:   raw.recovered_estimated   ?? FALLBACK_SNAPSHOT.recovered_estimated,
    uganda_confirmed:      raw.uganda_confirmed      ?? FALLBACK_SNAPSHOT.uganda_confirmed,
    uganda_deaths:         raw.uganda_deaths         ?? FALLBACK_SNAPSHOT.uganda_deaths,
    countries_affected:    raw.countries_affected    ?? FALLBACK_SNAPSHOT.countries_affected,
    health_zones_affected: raw.health_zones_affected ?? FALLBACK_SNAPSHOT.health_zones_affected,
    data_as_of:            raw.data_as_of            || raw.created_at || FALLBACK_SNAPSHOT.data_as_of,
    source:                raw.source                || FALLBACK_SNAPSHOT.source,
    created_at:            raw.created_at,
    provinces:             (provinces  && Array.isArray(provinces)  && provinces.length > 0)  ? provinces  : FALLBACK_SNAPSHOT.provinces,
    trend:                 normalizedTrend                                                      ? normalizedTrend : FALLBACK_SNAPSHOT.trend,
    contact_tracing:       (contact_tracing && contact_tracing.total_contacts_identified)       ? contact_tracing : FALLBACK_SNAPSHOT.contact_tracing,
    sources_comparison:    (sources_comparison  && Array.isArray(sources_comparison)  && sources_comparison.length > 0)  ? sources_comparison  : FALLBACK_SNAPSHOT.sources_comparison,
    source_discrepancies:  (source_discrepancies && source_discrepancies.title)                  ? source_discrepancies : FALLBACK_SNAPSHOT.source_discrepancies,
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
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error) throw error;
    rawSnapshot = data;
  } catch (err) {
    supabaseError = err.message;
    console.warn('[ebola-data] Supabase unavailable:', err.message);
  }

  const snapshot = rawSnapshot ? mergeWithFallback(rawSnapshot) : FALLBACK_SNAPSHOT;

  const drcHistory = [
    ...DRC_HISTORY_BASE,
    { label: '2026 (en cours)', cases: snapshot.confirmed_cases, deaths: snapshot.confirmed_deaths, cfr: snapshot.cfr_confirmed },
  ];

  const allData = [
    ...HISTORICAL_DATA,
    { year: 2026, country: 'DRC',    cases: snapshot.confirmed_cases,  deaths: snapshot.confirmed_deaths, cfr: snapshot.cfr_confirmed, species: 'Bundibugyo', status: 'Ongoing' },
    { year: 2026, country: 'Uganda', cases: snapshot.uganda_confirmed, deaths: snapshot.uganda_deaths,    cfr: snapshot.uganda_confirmed ? parseFloat(((snapshot.uganda_deaths / snapshot.uganda_confirmed) * 100).toFixed(1)) : 0, species: 'Bundibugyo', status: 'Ongoing' },
  ];

  res.status(200).json({
    success: true,
    generated_at:   new Date().toISOString(),
    data_as_of:     snapshot.data_as_of,
    data_source:    supabaseError ? 'FALLBACK_STATIC (Supabase indisponible)' : 'Supabase (cron 8h UTC)',
    primary_source: 'INSP RDC — https://insp.cd/blog-2/',
    supabase_error: supabaseError || null,
    disclaimer: "Outil d'aide à la décision. Source primaire : INSP RDC (insp.cd/blog-2). Complété par WHO, ECDC, MSF, CDC, UNFPA.",
    methodology: {
      primary_source:      'INSP RDC SitReps MVE (insp.cd/blog-2) — source officielle du Ministère de la Santé RDC. Publiés quotidiennement.',
      secondary_sources:   'WHO DON, ECDC Rapid Risk, MSF, CDC, UNFPA, ONU News — triangulation et données Ouganda.',
      cfr:                 'CFR = Décès confirmés / Cas confirmés × 100.',
      suspects_definition: 'Cas suspect = fièvre + symptômes hémorragiques ou contact confirmé (déf. INSP/WHO).',
      rt:                  'Rᵗ estimé EpiEstim (Cori 2013). SI BDBV ≈7j. IC 95%: [1.4–2.1].',
      update_frequency:    'Veille quotidienne INSP (insp.cd/blog-2). Cron Vercel 08h00 UTC.',
      insp_sitrep_list:    'https://insp.cd/blog-2/',
      insp_url_pattern:    'https://insp.cd/sitrep-n{NNN}-mvb_{JJ}-2026/',
    },
    outbreak_2026: {
      meta: {
        declaration_date:    '2026-05-15',
        pheic_date:          '2026-05-17',
        virus:               'Bundibugyo ebolavirus (BDBV)',
        outbreak_number:     17,
        no_approved_vaccine: true,
        index_case:          'Infirmière, Zone de santé de Mongbwalu, Ituri',
        last_data_update:    snapshot.data_as_of,
        last_verified_by:    snapshot.source,
        primary_source_url:  'https://insp.cd/sitrep-n017-mvb_31-2026/',
        sitrep_list_url:     'https://insp.cd/blog-2/',
      },
      totals: {
        confirmed_cases:       snapshot.confirmed_cases,
        suspected_cases:       snapshot.suspected_cases,
        confirmed_deaths:      snapshot.confirmed_deaths,
        total_deaths_all:      snapshot.total_deaths_all,
        recovered_estimated:   snapshot.recovered_estimated || null,
        cfr_confirmed:         snapshot.cfr_confirmed,
        uganda_confirmed:      snapshot.uganda_confirmed,
        uganda_deaths:         snapshot.uganda_deaths,
        countries_affected:    snapshot.countries_affected,
        health_zones_affected: snapshot.health_zones_affected,
        source:                snapshot.source,
      },
      sources_comparison:   snapshot.sources_comparison,
      source_discrepancies: snapshot.source_discrepancies,
      provinces:            snapshot.provinces,
      trend:                snapshot.trend,
      contact_tracing:      snapshot.contact_tracing,
      rt:                   RT_METADATA,
      risk_factors:         RISK_FACTORS_BASE,
    },
    historical:             allData,
    drc_history_comparison: drcHistory,
  });
}
