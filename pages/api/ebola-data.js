/**
 * /api/ebola-data — EBOLA-MONITOR v4.2
 *
 * MULTI-SOURCES TRANSPARENTES:
 * Chaque chiffre est accompagné de sa source, sa date et son URL.
 * Les écarts entre sources sont documentés et expliqués dans le champ
 * `source_discrepancies` pour une transparence totale.
 *
 * Flux:
 * 1. Supabase (snapshot auto-mis à jour via cron 8h UTC)
 * 2. Fallback statique si Supabase indisponible (données vérifiées 29 mai 2026)
 */

import { supabase } from '../../lib/supabase';
import { HISTORICAL_DATA, DRC_HISTORY_BASE, RT_METADATA, RISK_FACTORS_BASE } from '../../lib/historical-data';

// ── FALLBACK MULTI-SOURCES ──────────────────────────────────────────────────
// Données vérifiées manuellement au 29 mai 2026
// Chaque source est documentée avec date + URL
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

  // ── SOURCES MULTI avec explication des écarts ───────────────────────────
  sources_comparison: [
    {
      name: 'WHO DON603',
      date: '2026-05-20',
      confirmed_cases: 121,
      suspected_cases: null,
      confirmed_deaths: 17,
      total_deaths: 223,
      note: 'Dernier Disease Outbreak Notice officiel WHO. Chiffres confirmés uniquement, suspects non rapportés séparément.',
      url: 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603',
    },
    {
      name: 'ECDC Rapid Risk Assessment',
      date: '2026-05-28',
      confirmed_cases: 125,
      suspected_cases: 1077,
      confirmed_deaths: 17,
      total_deaths: 238,
      note: 'ECDC agrège WHO + MinSanté RDC. Inclut cas suspects selon définition OMS large. 1 077 suspects = cas sous investigation non encore confirmés en labo.',
      url: 'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda',
    },
    {
      name: 'MSF Briefing',
      date: '2026-05-28',
      confirmed_cases: 125,
      suspected_cases: 906,
      confirmed_deaths: 17,
      total_deaths: 223,
      note: 'MSF utilise définition de cas opérationnelle terrain, plus restrictive. Écart 906 vs 1077 suspects = différence de définition de cas suspect entre MSF (symptômes + contact) et ECDC/WHO (symptômes seuls).',
      url: 'https://www.msf.org/ebola-disease-drc-msf-scales-response-rapidly-evolving-outbreak',
    },
    {
      name: 'CDC Situation Summary',
      date: '2026-05-29',
      confirmed_cases: 125,
      suspected_cases: null,
      confirmed_deaths: 17,
      total_deaths: null,
      note: 'CDC reprend les chiffres WHO confirmés. Ne rapporte pas les suspects indépendamment.',
      url: 'https://www.cdc.gov/ebola/situation-summary/index.html',
    },
    {
      name: 'UNFPA Flash Update',
      date: '2026-05-27',
      confirmed_cases: 121,
      suspected_cases: 1012,
      confirmed_deaths: 17,
      total_deaths: 240,
      note: 'UNFPA rapporte au 26 mai. Légère différence de date par rapport ECDC (26 vs 28 mai) explique l\'écart 1012 vs 1077 suspects.',
      url: 'https://www.unfpa.org/resources/unfpa-flash-update-bundibugyo-ebola-virus-disease-bvd-outbreak-20-26-may-2026',
    },
  ],

  // ── EXPLICATION DES ÉCARTS ──────────────────────────────────────────────
  source_discrepancies: {
    title: 'Pourquoi les chiffres diffèrent entre sources ?',
    reasons: [
      {
        label: 'Définition de cas suspect',
        detail: 'WHO/ECDC: fièvre + un symptôme hémorragique. MSF terrain: fièvre + contact connu + symptômes. La définition MSF est plus restrictive → moins de suspects.',
      },
      {
        label: 'Délai de rapportage',
        detail: 'Les sitreps ont des dates différentes. UNFPA au 26 mai vs ECDC au 28 mai = 2 jours d\'écart pendant une phase d\'accélération rapide.',
      },
      {
        label: 'Consolidation laboratoire',
        detail: 'Certains cas suspects deviennent confirmés ou infirmés entre deux rapports. Un cas confirmé dans un rapport peut encore être suspect dans le suivant si le lab n\'a pas encore transmis.',
      },
      {
        label: 'Accès terrain limité',
        detail: 'Conflit armé actif Nord-Kivu/Sud-Kivu. Certaines zones de santé rapportent avec retard ou via relais indirect (MSF, OCHA).',
      },
    ],
    consensus: 'Chiffres consensuels retenus: 125 confirmés, 1077 suspects (ECDC 28 mai — source la plus exhaustive), 17 décès confirmés, CFR confirmé 13.6%.',
  },

  provinces: [
    { province:'Ituri',     zone:'Mongbwalu',  cases:51, deaths:8,  cfr:15.7, status:'Active',    country:'DRC',    source:'WHO DON602+ECDC',  source_date:'2026-05-28', source_url:'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda' },
    { province:'Ituri',     zone:'Bunia',      cases:31, deaths:5,  cfr:16.1, status:'Active',    country:'DRC',    source:'ECDC 28 mai',      source_date:'2026-05-28', source_url:'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda' },
    { province:'Ituri',     zone:'Rwampara',   cases:20, deaths:3,  cfr:15.0, status:'Active',    country:'DRC',    source:'WHO DON602',       source_date:'2026-05-20', source_url:'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON602' },
    { province:'Nord-Kivu', zone:'Butembo',    cases:9,  deaths:1,  cfr:11.1, status:'Active',    country:'DRC',    source:'ECDC 28 mai',      source_date:'2026-05-28', source_url:'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda' },
    { province:'Nord-Kivu', zone:'Goma',       cases:5,  deaths:0,  cfr:0,    status:'Monitoring',country:'DRC',    source:'ECDC 28 mai',      source_date:'2026-05-28', source_url:'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda' },
    { province:'Sud-Kivu',  zone:'Multiple',   cases:4,  deaths:0,  cfr:0,    status:'Monitoring',country:'DRC',    source:'ECDC 28 mai',      source_date:'2026-05-28', source_url:'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda' },
    { province:'Kinshasa',  zone:'Surveillance',cases:2, deaths:0,  cfr:0,    status:'Monitoring',country:'DRC',    source:'MinSanté RDC/ECDC',source_date:'2026-05-28', source_url:'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda' },
    { province:'Maniema',   zone:'Surveillance',cases:3, deaths:0,  cfr:0,    status:'Monitoring',country:'DRC',    source:'ECDC 28 mai',      source_date:'2026-05-28', source_url:'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda' },
    { province:'Uganda',    zone:'Kampala+',   cases:9,  deaths:1,  cfr:11.1, status:'Monitoring',country:'Uganda', source:'WHO DON603',       source_date:'2026-05-20', source_url:'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603' },
  ],

  trend: {
    source: 'Reconstruction depuis WHO DON601-603 + ECDC sitreps hebdomadaires + UNFPA Flash Updates',
    source_url: 'https://www.who.int/emergencies/situations/ebola-outbreak---drc-2026',
    note: 'Suspects: ECDC (1077 au 26 mai) vs MSF (906 au 28 mai) — écart expliqué par définition de cas différente.',
    dates:          ['15 mai','16 mai','17 mai','18 mai','19 mai','21 mai','22 mai','24 mai','26 mai','28 mai','29 mai'],
    confirmed:      [8,       8,       10,      13,      22,      31,      40,      51,      70,      121,     125    ],
    suspected_ecdc: [246,     248,     280,     300,     528,     516,     650,     800,     1012,    1077,    1077   ],
    suspected_msf:  [null,    null,    null,    null,    null,    null,    null,    null,    null,    906,     906    ],
    deaths_conf:    [1,       1,       2,       3,       5,       7,       10,      14,      16,      17,      17     ],
    deaths_all:     [40,      42,      55,      80,      120,     160,     195,     220,     238,     246,     246    ],
    sources_by_date: [
      { date:'15 mai', source:'WHO DON601', url:'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON601' },
      { date:'18 mai', source:'UNFPA Flash 14-19 mai', url:'https://www.unfpa.org/resources/unfpa-flash-update-ebola-outbreak-drc-14-19-may-2026' },
      { date:'20 mai', source:'WHO DON603', url:'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603' },
      { date:'26 mai', source:'UNFPA Flash 20-26 mai', url:'https://reliefweb.int/report/democratic-republic-congo/unfpa-flash-update-bundibugyo-ebola-virus-disease-bvd-outbreak-20-26-may' },
      { date:'28 mai', source:'ECDC + MSF', url:'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda' },
    ],
  },

  contact_tracing: {
    total_contacts_identified: 668,
    drc_contacts: 541,
    uganda_contacts: 127,
    source: 'WHO Situation Report',
    source_date: '2026-05-18',
    source_url: 'https://www.who.int/emergencies/situations/ebola-outbreak---drc-2026',
    note: 'Données agrégées nationales — répartition par zone non disponible publiquement.',
  },
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=14400, stale-while-revalidate=28800');

  let snapshot = null;
  let supabaseError = null;

  try {
    const { data, error } = await supabase
      .from('outbreak_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error) throw error;
    snapshot = data;
  } catch (err) {
    supabaseError = err.message;
    console.warn('[ebola-data] Supabase unavailable:', err.message);
    snapshot = FALLBACK_SNAPSHOT;
  }

  const drcHistory = [
    ...DRC_HISTORY_BASE,
    {
      label: '2026 (en cours)',
      cases: snapshot.confirmed_cases,
      deaths: snapshot.confirmed_deaths,
      cfr: snapshot.cfr_confirmed,
    },
  ];

  const allData = [
    ...HISTORICAL_DATA,
    { year:2026, country:'DRC',    cases: snapshot.confirmed_cases,  deaths: snapshot.confirmed_deaths, cfr: snapshot.cfr_confirmed,  species:'Bundibugyo', status:'Ongoing' },
    { year:2026, country:'Uganda', cases: snapshot.uganda_confirmed, deaths: snapshot.uganda_deaths,    cfr: snapshot.uganda_confirmed ? parseFloat(((snapshot.uganda_deaths / snapshot.uganda_confirmed) * 100).toFixed(1)) : 0, species:'Bundibugyo', status:'Ongoing' },
  ];

  res.status(200).json({
    success: true,
    generated_at: new Date().toISOString(),
    data_as_of: snapshot.data_as_of || snapshot.created_at,
    data_source: supabaseError ? 'FALLBACK_STATIC (Supabase indisponible)' : 'Supabase (cron 8h UTC)',
    supabase_error: supabaseError || null,

    disclaimer: "Outil d'aide à la décision basé sur sources publiques officielles (WHO, ECDC, MSF, CDC, UNFPA). Ne remplace pas les SitReps officiels du Ministère de la Santé de la RDC.",

    methodology: {
      cfr: "CFR = Décès confirmés / Cas confirmés × 100. Les décès suspects ne sont PAS inclus dans le CFR confirmé.",
      suspects_definition: "Cas suspect = personne présentant fièvre soudaine + symptômes hémorragiques ou contact avec cas confirmé. Définition varie selon organisation (voir source_discrepancies).",
      rt: "Rᵗ estimé par EpiEstim (Cori et al. 2013). Intervalle sériel BDBV ≈ 7 jours. IC 95%: [1.4–2.1]. Source: Imperial College London/WHO.",
      update_frequency: "Données auto-mises à jour 1×/jour à 08h00 UTC via cron Vercel → parser WHO/ECDC → Supabase.",
    },

    outbreak_2026: {
      meta: {
        declaration_date: '2026-05-15',
        pheic_date: '2026-05-17',
        virus: 'Bundibugyo ebolavirus (BDBV)',
        outbreak_number: 17,
        no_approved_vaccine: true,
        index_case: 'Infirmière, Zone de santé de Mongbwalu, Ituri',
        last_data_update: snapshot.data_as_of || snapshot.created_at,
        last_verified_by: snapshot.source,
      },
      totals: {
        confirmed_cases:        snapshot.confirmed_cases,
        suspected_cases:        snapshot.suspected_cases,
        confirmed_deaths:       snapshot.confirmed_deaths,
        total_deaths_all:       snapshot.total_deaths_all,
        recovered_estimated:    snapshot.recovered_estimated || null,
        cfr_confirmed:          snapshot.cfr_confirmed,
        uganda_confirmed:       snapshot.uganda_confirmed,
        uganda_deaths:          snapshot.uganda_deaths,
        countries_affected:     snapshot.countries_affected,
        health_zones_affected:  snapshot.health_zones_affected,
        source:                 snapshot.source,
      },
      sources_comparison:    snapshot.sources_comparison    || FALLBACK_SNAPSHOT.sources_comparison,
      source_discrepancies:  snapshot.source_discrepancies  || FALLBACK_SNAPSHOT.source_discrepancies,
      provinces:             snapshot.provinces,
      trend:                 snapshot.trend,
      contact_tracing:       snapshot.contact_tracing,
      rt:                    RT_METADATA,
      risk_factors:          RISK_FACTORS_BASE,
    },

    historical:             allData,
    drc_history_comparison: drcHistory,
  });
}
