/**
 * /api/ebola-data — EBOLA-MONITOR v4.4
 *
 * CORRECTION CRITIQUE: mergeWithFallback parse les champs JSON
 * qui arrivent comme strings depuis Supabase (colonnes TEXT vs JSONB).
 * C'est la cause du bug : tables/graphiques vides malgré KPI ok.
 */

import { supabase } from '../../lib/supabase';
import { HISTORICAL_DATA, DRC_HISTORY_BASE, RT_METADATA, RISK_FACTORS_BASE } from '../../lib/historical-data';

// ── FALLBACK STATIQUE ──────────────────────────────────────────────────
const FALLBACK_SNAPSHOT = {
  confirmed_cases: 125,
  suspected_cases: 1077,
  confirmed_deaths: 17,
  total_deaths_all: 246,
  cfr_confirmed: 13.6,
  recovered_estimated: 55,
  uganda_confirmed: 9,
  uganda_deaths: 1,
  countries_affected: 2,
  health_zones_affected: 11,
  data_as_of: '2026-05-29T00:00:00Z',
  source: 'WHO DON603 + ECDC 28 mai + MSF 28 mai [FALLBACK]',

  sources_comparison: [
    { name:'WHO DON603',             date:'2026-05-20', confirmed_cases:121, suspected_cases:null, confirmed_deaths:17, total_deaths:223, note:'Dernier DON officiel WHO.',              url:'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603' },
    { name:'ECDC Rapid Risk',        date:'2026-05-28', confirmed_cases:125, suspected_cases:1077, confirmed_deaths:17, total_deaths:238, note:'ECDC agrège WHO + MinSanté RDC.',       url:'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda' },
    { name:'MSF Briefing',           date:'2026-05-28', confirmed_cases:125, suspected_cases:906,  confirmed_deaths:17, total_deaths:223, note:'Définition cas opérationnelle terrain.', url:'https://www.msf.org/ebola-disease-drc-msf-scales-response-rapidly-evolving-outbreak' },
    { name:'CDC Situation Summary',  date:'2026-05-29', confirmed_cases:125, suspected_cases:null, confirmed_deaths:17, total_deaths:null, note:'Reprend chiffres WHO confirmés.',       url:'https://www.cdc.gov/ebola/situation-summary/index.html' },
    { name:'UNFPA Flash Update',     date:'2026-05-27', confirmed_cases:121, suspected_cases:1012, confirmed_deaths:17, total_deaths:240, note:'Rapport au 26 mai.',                     url:'https://www.unfpa.org/resources/unfpa-flash-update-bundibugyo-ebola-virus-disease-bvd-outbreak-20-26-may-2026' },
  ],

  source_discrepancies: {
    title: 'Pourquoi les chiffres diffèrent entre sources ?',
    reasons: [
      { label:'Définition de cas suspect',  detail:'WHO/ECDC: fièvre + symptôme hémorragique. MSF: fièvre + contact + symptômes — plus restrictif.' },
      { label:'Délai de rapportage',        detail:'Sitreps à dates différentes. UNFPA 26 mai vs ECDC 28 mai = 2 jours d\'écart.' },
      { label:'Consolidation laboratoire', detail:'Certains suspects deviennent confirmés entre deux rapports.' },
      { label:'Accès terrain limité',       detail:'Conflit armé actif Nord-Kivu/Sud-Kivu. Zones rapportant avec retard.' },
    ],
    consensus: 'Chiffres retenus : 125 confirmés, 1077 suspects (ECDC 28 mai), 17 décès confirmés, CFR 13.6 %.',
  },

  provinces: [
    { province:'Ituri',     zone:'Mongbwalu',    cases:51, deaths:8, cfr:15.7, status:'Active',     country:'DRC',    source:'WHO DON602+ECDC',   source_date:'2026-05-28' },
    { province:'Ituri',     zone:'Bunia',        cases:31, deaths:5, cfr:16.1, status:'Active',     country:'DRC',    source:'ECDC 28 mai',       source_date:'2026-05-28' },
    { province:'Ituri',     zone:'Rwampara',     cases:20, deaths:3, cfr:15.0, status:'Active',     country:'DRC',    source:'WHO DON602',        source_date:'2026-05-20' },
    { province:'Nord-Kivu', zone:'Butembo',      cases:9,  deaths:1, cfr:11.1, status:'Active',     country:'DRC',    source:'ECDC 28 mai',       source_date:'2026-05-28' },
    { province:'Nord-Kivu', zone:'Goma',         cases:5,  deaths:0, cfr:0,    status:'Monitoring', country:'DRC',    source:'ECDC 28 mai',       source_date:'2026-05-28' },
    { province:'Sud-Kivu',  zone:'Multiple',     cases:4,  deaths:0, cfr:0,    status:'Monitoring', country:'DRC',    source:'ECDC 28 mai',       source_date:'2026-05-28' },
    { province:'Kinshasa',  zone:'Surveillance', cases:2,  deaths:0, cfr:0,    status:'Monitoring', country:'DRC',    source:'MinSanté RDC/ECDC', source_date:'2026-05-28' },
    { province:'Maniema',   zone:'Surveillance', cases:3,  deaths:0, cfr:0,    status:'Monitoring', country:'DRC',    source:'ECDC 28 mai',       source_date:'2026-05-28' },
    { province:'Uganda',    zone:'Kampala+',     cases:9,  deaths:1, cfr:11.1, status:'Monitoring', country:'Uganda', source:'WHO DON603',        source_date:'2026-05-20' },
  ],

  trend: {
    source: 'Reconstruction WHO DON601-603 + ECDC sitreps + UNFPA Flash Updates',
    source_url: 'https://www.who.int/emergencies/situations/ebola-outbreak---drc-2026',
    note: 'Suspects: ECDC (1077 au 28 mai) vs MSF (906 au 28 mai).',
    dates:          ['15 mai','16 mai','17 mai','18 mai','19 mai','21 mai','22 mai','24 mai','26 mai','28 mai','29 mai'],
    confirmed:      [8,       8,       10,      13,      22,      31,      40,      51,      70,      121,     125    ],
    suspected_ecdc: [246,     248,     280,     300,     528,     516,     650,     800,     1012,    1077,    1077   ],
    suspected_msf:  [null,    null,    null,    null,    null,    null,    null,    null,    null,    906,     906    ],
    deaths_conf:    [1,       1,       2,       3,       5,       7,       10,      14,      16,      17,      17     ],
    deaths_all:     [40,      42,      55,      80,      120,     160,     195,     220,     238,     246,     246    ],
  },

  contact_tracing: {
    total_contacts_identified: 668,
    drc_contacts: 541,
    uganda_contacts: 127,
    source: 'WHO Situation Report',
    source_date: '2026-05-18',
    source_url: 'https://www.who.int/emergencies/situations/ebola-outbreak---drc-2026',
  },
};

/**
 * Parse un champ qui peut être soit un objet/tableau JS,
 * soit une string JSON (cas Supabase colonnes TEXT).
 */
function parseField(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch(e) { return null; }
  }
  return val;
}

/**
 * Fusionne le snapshot Supabase avec le fallback.
 * CORRECTION CLÉ: parse tous les champs complexes qui peuvent arriver
 * comme strings JSON depuis Supabase (colonnes TEXT au lieu de JSONB).
 */
function mergeWithFallback(raw) {
  const provinces           = parseField(raw.provinces);
  const trend               = parseField(raw.trend);
  const contact_tracing     = parseField(raw.contact_tracing);
  const sources_comparison  = parseField(raw.sources_comparison);
  const source_discrepancies = parseField(raw.source_discrepancies);

  // Normaliser le trend (compatibilité ancien champ 'suspected' singulier)
  let normalizedTrend = null;
  if (trend && Array.isArray(trend.dates) && trend.dates.length > 0) {
    normalizedTrend = {
      ...trend,
      suspected_ecdc: trend.suspected_ecdc || trend.suspected || [],
      suspected_msf:  trend.suspected_msf  || [],
      deaths_conf:    trend.deaths_conf    || [],
      deaths_all:     trend.deaths_all     || [],
    };
  }

  return {
    // Champs scalaires du snapshot Supabase (KPI — écrasent le fallback)
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
    // Champs complexes: parsed + fallback si invalides
    provinces:             (provinces  && Array.isArray(provinces)  && provinces.length)  ? provinces  : FALLBACK_SNAPSHOT.provinces,
    trend:                 normalizedTrend                                                 ? normalizedTrend : FALLBACK_SNAPSHOT.trend,
    contact_tracing:       (contact_tracing && contact_tracing.total_contacts_identified)  ? contact_tracing : FALLBACK_SNAPSHOT.contact_tracing,
    sources_comparison:    (sources_comparison  && Array.isArray(sources_comparison)  && sources_comparison.length)  ? sources_comparison  : FALLBACK_SNAPSHOT.sources_comparison,
    source_discrepancies:  (source_discrepancies && source_discrepancies.title)             ? source_discrepancies : FALLBACK_SNAPSHOT.source_discrepancies,
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
    { label:'2026 (en cours)', cases: snapshot.confirmed_cases, deaths: snapshot.confirmed_deaths, cfr: snapshot.cfr_confirmed },
  ];

  const allData = [
    ...HISTORICAL_DATA,
    { year:2026, country:'DRC',    cases: snapshot.confirmed_cases,  deaths: snapshot.confirmed_deaths, cfr: snapshot.cfr_confirmed, species:'Bundibugyo', status:'Ongoing' },
    { year:2026, country:'Uganda', cases: snapshot.uganda_confirmed, deaths: snapshot.uganda_deaths,    cfr: snapshot.uganda_confirmed ? parseFloat(((snapshot.uganda_deaths / snapshot.uganda_confirmed)*100).toFixed(1)) : 0, species:'Bundibugyo', status:'Ongoing' },
  ];

  res.status(200).json({
    success: true,
    generated_at:   new Date().toISOString(),
    data_as_of:     snapshot.data_as_of,
    data_source:    supabaseError ? 'FALLBACK_STATIC (Supabase indisponible)' : 'Supabase (cron 8h UTC)',
    supabase_error: supabaseError || null,

    disclaimer: "Outil d'aide à la décision basé sur sources publiques officielles (WHO, ECDC, MSF, CDC, UNFPA).",

    methodology: {
      cfr:                  'CFR = Décès confirmés / Cas confirmés × 100.',
      suspects_definition:  'Cas suspect = fièvre + symptômes hémorragiques ou contact confirmé.',
      rt:                   'Rᵗ estimé par EpiEstim (Cori 2013). SI BDBV ≈ 7j. IC 95%: [1.4–2.1].',
      update_frequency:     'Données mises à jour 1×/jour à 08h00 UTC via cron Vercel.',
    },

    outbreak_2026: {
      meta: {
        declaration_date:   '2026-05-15',
        pheic_date:         '2026-05-17',
        virus:              'Bundibugyo ebolavirus (BDBV)',
        outbreak_number:    17,
        no_approved_vaccine: true,
        index_case:         'Infirmière, Zone de santé de Mongbwalu, Ituri',
        last_data_update:   snapshot.data_as_of,
        last_verified_by:   snapshot.source,
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
