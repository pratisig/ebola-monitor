/**
 * /api/ebola-data — EBOLA-MONITOR v4.5.3
 *
 * CORRECTIONS v4.5.3 :
 * - Requête Supabase : ORDER BY data_as_of DESC (plus fiable que created_at)
 *   + filtre parse_confidence != 'auto_invalid' pour éviter les auto-parses défectueux
 * - Source primaire : INSP RDC SitRep N°017 Révisé (PDF 01/06/2026)
 * - Fallback statique mis à jour avec les vrais chiffres INSP N°017 révisé
 *
 * ORDRE DE PRIORITÉ SOURCE :
 *   1. INSP RDC   insp.cd/blog-2/         (quotidien) = SOURCE OFFICIELLE RDC
 *   2. WHO AFRO   afro.who.int            (2x/semaine)
 *   3. ECDC       ecdc.europa.eu          (2x/semaine)
 *   4. WHO DON    who.int/emergencies/don (~10-12 jours de retard sur INSP)
 */

import { supabase } from '../../lib/supabase';
import { HISTORICAL_DATA, DRC_HISTORY_BASE, RT_METADATA, RISK_FACTORS_BASE } from '../../lib/historical-data';

// ── FALLBACK — INSP RDC SitRep N°017 Révisé — PDF 01/06/2026 ──
const FALLBACK_SNAPSHOT = {
  confirmed_cases       : 173,
  suspected_cases       : 1190,
  confirmed_deaths      : 47,
  total_deaths_all      : 310,
  cfr_confirmed         : 27.2,
  recovered_estimated   : 68,
  uganda_confirmed      : 9,
  uganda_deaths         : 1,
  countries_affected    : 2,
  health_zones_affected : 15,
  data_as_of            : '2026-06-01T00:00:00Z',
  source                : 'INSP RDC SitRep MVE N°017 Révisé — 01 juin 2026 [SOURCE OFFICIELLE RDC]',

  sources_comparison: [
    {
      name: 'INSP RDC SitRep N°017 Révisé (PDF)',
      date: '2026-06-01',
      confirmed_cases: 173, suspected_cases: 1190, confirmed_deaths: 47, total_deaths: 310,
      note: 'SOURCE OFFICIELLE PRIORITAIRE. PDF: SitRep_MVE_RDC_N017_01_06_2026-Revised_JO_PA_IM-1.pdf. Données par zone de santé. 3 provinces, 15 ZS.',
      url: 'https://insp.cd/sitrep-n017-mvb_31-2026/',
      is_primary: true,
    },
    {
      name: 'INSP RDC SitRep N°012',
      date: '2026-05-26',
      confirmed_cases: 121, suspected_cases: 1050, confirmed_deaths: 16, total_deaths: 232,
      note: 'Ituri : 110 cas, Nord-Kivu : 10, Sud-Kivu : 1. Référence ReliefWeb.',
      url: 'https://reliefweb.int/report/democratic-republic-congo/rapport-de-situation-de-la-17eme-epidemie-de-la-maladie-virus-ebolardc-sitrep-mve-sitrep-n012mvb_262026',
    },
    {
      name: 'WHO DON603',
      date: '2026-05-20',
      confirmed_cases: 121, suspected_cases: null, confirmed_deaths: 17, total_deaths: 223,
      note: 'Retard 12 jours sur INSP N°017 révisé. Décès sous-estimés (17 vs 47 INSP).',
      url: 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603',
    },
    {
      name: 'ECDC Rapid Risk',
      date: '2026-05-28',
      confirmed_cases: 125, suspected_cases: 1077, confirmed_deaths: 17, total_deaths: 238,
      note: '4 jours de retard sur INSP. Agrège WHO + MinSanté. Parse auto-ECDC erroné (282 cas) exclu.',
      url: 'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda',
    },
    {
      name: 'MSF Briefing',
      date: '2026-05-28',
      confirmed_cases: 125, suspected_cases: 906, confirmed_deaths: 17, total_deaths: 223,
      note: 'Définition suspects terrain restrictive (906 vs 1190 INSP).',
      url: 'https://www.msf.org/ebola-disease-drc-msf-scales-response-rapidly-evolving-outbreak',
    },
    {
      name: 'UNFPA Flash Update',
      date: '2026-05-27',
      confirmed_cases: 121, suspected_cases: 1012, confirmed_deaths: 17, total_deaths: 240,
      note: 'Base sitreps INSP N°009–012. Retard 5 jours sur INSP N°017.',
      url: 'https://www.unfpa.org/resources/unfpa-flash-update-bundibugyo-ebola-virus-disease-bvd-outbreak-20-26-may-2026',
    },
  ],

  source_discrepancies: {
    title: 'Pourquoi les chiffres diffèrent entre sources ?',
    reasons: [
      { label: 'INSP RDC = source primaire officielle',
        detail: 'INSP publie quotidiennement depuis insp.cd/blog-2. PDF officiel. WHO/ECDC répliquent avec 4–12 jours de retard. Écart actuel : 47 décès INSP (01/06) vs 17 décès WHO DON603 (20/05).' },
      { label: 'Définition de cas suspect',
        detail: 'INSP/ECDC : fièvre + hémorragie → 1190 suspects. MSF terrain : fièvre + contact + symptômes → 906 suspects. Écart : 284.' },
      { label: 'Délai de rapportage',
        detail: 'INSP : quotidien. WHO DON : ~10-12 jours. ECDC : 2x/semaine. Auto-parse ECDC erroné (282 cas) exclu de Supabase.' },
      { label: 'Consolidation labo INRB',
        detail: 'INSP intègre résultats PCR INRB sous 24h. WHO attend validation formelle avant publication DON.' },
      { label: 'Accès terrain limité',
        detail: 'Conflit armé Nord-Kivu/Sud-Kivu. Zones isolées rapportent avec retard.' },
    ],
    consensus: 'Source retenue : INSP N°017 révisé PDF (01/06/2026) : 173 confirmés, 1190 suspects, 47 décès, CFR 27.2%. WHO DON603 et ECDC reflètent l\'état au 20–28 mai uniquement.',
  },

  provinces: [
    { province:'Ituri',     zone:'Mongbwalu',    cases:75, deaths:22, cfr:29.3, status:'Active',     country:'DRC',    source:'INSP N°017 Révisé', source_date:'2026-06-01' },
    { province:'Ituri',     zone:'Bunia',        cases:45, deaths:13, cfr:28.9, status:'Active',     country:'DRC',    source:'INSP N°017 Révisé', source_date:'2026-06-01' },
    { province:'Ituri',     zone:'Rwampara',     cases:24, deaths:7,  cfr:29.2, status:'Active',     country:'DRC',    source:'INSP N°017 Révisé', source_date:'2026-06-01' },
    { province:'Ituri',     zone:'Nyakunde',     cases:6,  deaths:2,  cfr:33.3, status:'Active',     country:'DRC',    source:'INSP N°017 Révisé', source_date:'2026-06-01' },
    { province:'Ituri',     zone:'Nizi',         cases:5,  deaths:1,  cfr:20.0, status:'Active',     country:'DRC',    source:'INSP N°017 Révisé', source_date:'2026-06-01' },
    { province:'Ituri',     zone:'Kilo',         cases:3,  deaths:0,  cfr:0.0,  status:'Monitoring', country:'DRC',    source:'INSP N°017 Révisé', source_date:'2026-06-01' },
    { province:'Ituri',     zone:'Aru',          cases:2,  deaths:0,  cfr:0.0,  status:'Monitoring', country:'DRC',    source:'INSP N°017 Révisé', source_date:'2026-06-01' },
    { province:'Nord-Kivu', zone:'Butembo',      cases:9,  deaths:2,  cfr:22.2, status:'Active',     country:'DRC',    source:'INSP N°017 Révisé', source_date:'2026-06-01' },
    { province:'Nord-Kivu', zone:'Goma',         cases:5,  deaths:0,  cfr:0.0,  status:'Monitoring', country:'DRC',    source:'INSP N°017 Révisé', source_date:'2026-06-01' },
    { province:'Nord-Kivu', zone:'Katwa',        cases:3,  deaths:0,  cfr:0.0,  status:'Monitoring', country:'DRC',    source:'INSP N°017 Révisé', source_date:'2026-06-01' },
    { province:'Nord-Kivu', zone:'Lubero',       cases:2,  deaths:0,  cfr:0.0,  status:'Monitoring', country:'DRC',    source:'INSP N°017 Révisé', source_date:'2026-06-01' },
    { province:'Nord-Kivu', zone:'Virunga',      cases:1,  deaths:0,  cfr:0.0,  status:'Monitoring', country:'DRC',    source:'INSP N°017 Révisé', source_date:'2026-06-01' },
    { province:'Sud-Kivu',  zone:'Miti-Murhesa', cases:4,  deaths:0,  cfr:0.0,  status:'Monitoring', country:'DRC',    source:'INSP N°017 Révisé', source_date:'2026-06-01' },
    { province:'Kinshasa',  zone:'Surveillance', cases:2,  deaths:0,  cfr:0.0,  status:'Monitoring', country:'DRC',    source:'INSP N°017 Révisé', source_date:'2026-06-01' },
    { province:'Uganda',    zone:'Kampala+',     cases:9,  deaths:1,  cfr:11.1, status:'Monitoring', country:'Uganda', source:'WHO DON603',          source_date:'2026-05-20' },
  ],

  trend: {
    source: 'INSP RDC SitReps MVE N°001–017 + WHO DON601-603 + ECDC + UNFPA',
    source_url: 'https://insp.cd/blog-2/',
    note: 'Source primaire INSP RDC. Suspects INSP 1190 au 01/06. WHO DON603 arreté au 20/05 (121 cas, 17 décès).',
    dates:          ['15 mai','17 mai','19 mai','21 mai','23 mai','25 mai','26 mai','28 mai','29 mai','01 juin'],
    confirmed:      [8,       10,      22,      31,      101,     116,     121,     125,     143,     173],
    suspected_ecdc: [246,     280,     513,     516,     null,    1050,    1077,    1077,    1103,    1190],
    suspected_msf:  [null,    null,    null,    null,    null,    null,    null,    906,     null,    null],
    deaths_conf:    [1,       2,       5,       7,       null,    16,      17,      17,      38,      47],
    deaths_all:     [40,      55,      131,     160,     null,    232,     238,     246,     280,     310],
  },

  contact_tracing: {
    total_contacts_identified: 745,
    drc_contacts: 612,
    uganda_contacts: 133,
    source: 'INSP RDC SitRep N°017 Révisé',
    source_date: '2026-06-01',
    source_url: 'https://insp.cd/sitrep-n017-mvb_31-2026/',
  },
};

function parseField(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch (e) { return null; } }
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
      source:         trend.source      || FALLBACK_SNAPSHOT.trend.source,
      source_url:     trend.source_url  || FALLBACK_SNAPSHOT.trend.source_url,
      note:           trend.note        || FALLBACK_SNAPSHOT.trend.note,
      dates:          trend.dates,
      confirmed:      trend.confirmed      || [],
      suspected_ecdc: trend.suspected_ecdc || trend.suspected || [],
      suspected_msf:  trend.suspected_msf  || [],
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
    provinces:             (provinces && Array.isArray(provinces) && provinces.length)  ? provinces  : FALLBACK_SNAPSHOT.provinces,
    trend:                 normalizedTrend                                               ? normalizedTrend : FALLBACK_SNAPSHOT.trend,
    contact_tracing:       (contact_tracing && contact_tracing.total_contacts_identified) ? contact_tracing : FALLBACK_SNAPSHOT.contact_tracing,
    sources_comparison:    (sources_comparison && Array.isArray(sources_comparison) && sources_comparison.length) ? sources_comparison : FALLBACK_SNAPSHOT.sources_comparison,
    source_discrepancies:  (source_discrepancies && source_discrepancies.title)          ? source_discrepancies : FALLBACK_SNAPSHOT.source_discrepancies,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=14400, stale-while-revalidate=28800');

  let rawSnapshot   = null;
  let supabaseError = null;

  try {
    // • ORDER BY data_as_of DESC : utilise la date de la donnée, pas de création de la row
    // • parse_confidence != 'auto_invalid' : exclut les auto-parses erronés
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

  const drcHistory = [
    ...DRC_HISTORY_BASE,
    { label: '2026 (en cours)', cases: snapshot.confirmed_cases, deaths: snapshot.confirmed_deaths, cfr: snapshot.cfr_confirmed },
  ];

  const allData = [
    ...HISTORICAL_DATA,
    { year:2026, country:'DRC',    cases:snapshot.confirmed_cases,  deaths:snapshot.confirmed_deaths, cfr:snapshot.cfr_confirmed, species:'Bundibugyo', status:'Ongoing' },
    { year:2026, country:'Uganda', cases:snapshot.uganda_confirmed, deaths:snapshot.uganda_deaths,    cfr:snapshot.uganda_confirmed ? parseFloat(((snapshot.uganda_deaths/snapshot.uganda_confirmed)*100).toFixed(1)) : 0, species:'Bundibugyo', status:'Ongoing' },
  ];

  res.status(200).json({
    success: true,
    generated_at:    new Date().toISOString(),
    data_as_of:      snapshot.data_as_of,
    data_source:     supabaseError ? 'FALLBACK_STATIC' : 'Supabase (ORDER BY data_as_of DESC)',
    primary_source:  'INSP RDC — https://insp.cd/blog-2/',
    supabase_error:  supabaseError || null,
    disclaimer:      "Source primaire : INSP RDC (insp.cd/blog-2). Complété par WHO, ECDC, MSF, CDC, UNFPA.",
    methodology: {
      primary_source:      'INSP RDC SitReps MVE PDF quotidiens (insp.cd/blog-2) — source officielle MinSanté RDC.',
      secondary_sources:   'WHO DON, ECDC, MSF, CDC, UNFPA, ONU News — triangulation et données Ouganda.',
      cfr:                 'CFR = Décès confirmés / Cas confirmés × 100.',
      suspects_definition: 'Cas suspect = fièvre + symptômes hémorragiques ou contact confirmé (INSP/WHO).',
      rt:                  'Rᵗ estimé EpiEstim (Cori 2013). SI BDBV ≈7j. IC95%: [1.4–2.1].',
      update_frequency:    'Veille INSP quotidienne. Cron Vercel 08h00 UTC. parse_confidence=auto_invalid exclus.',
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
        vaccine_in_dev:      'Africa CDC annonce vaccin BDBV d\'ici fin 2026 (Dr Jean Kaseya, 28 mai 2026)',
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
