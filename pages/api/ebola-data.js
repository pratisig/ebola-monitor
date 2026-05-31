/**
 * /api/ebola-data — API principale EBOLA-MONITOR v4.0
 *
 * Flux de données:
 * 1. Lit les données actuelles depuis Supabase (table 'outbreak_snapshots')
 * 2. Complète avec les données historiques statiques vérifiées
 * 3. Retourne le JSON complet avec métadonnées de source
 *
 * Cache Vercel CDN: 4 heures (s-maxage)
 * Stale-while-revalidate: 8 heures
 */

import { supabase } from '../../lib/supabase';
import { HISTORICAL_DATA, DRC_HISTORY_BASE, RT_METADATA, RISK_FACTORS_BASE } from '../../lib/historical-data';

// Données de référence vérifiées manuellement (fallback si Supabase indisponible)
// Source: ECDC 28 mai 2026 + MSF 28 mai 2026
const FALLBACK_SNAPSHOT = {
  confirmed_cases: 125,
  suspected_cases: 906,
  confirmed_deaths: 17,
  total_deaths_all: 223,
  cfr_confirmed: 13.6,
  cfr_note: 'CFR = 17 décès confirmés / 125 cas confirmés \u00d7 100 = 13.6%',
  suspected_note: 'Écart suspects: ECDC (1 077 au 26 mai) vs MSF (906 au 28 mai) — différences de définition de cas',
  uganda_confirmed: 9,
  uganda_deaths: 1,
  countries_affected: 2,
  health_zones_affected: 11,
  source: 'MSF 28 mai 2026 + ECDC 28 mai 2026 [FALLBACK]',
  data_as_of: '2026-05-29T00:00:00Z',
  provinces: [
    { province:'Ituri',     zone:'Mongbwalu',        cases:51, deaths:8, cfr:15.7, status:'Active',    country:'DRC',    source:'WHO DON602',   source_url:'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON602' },
    { province:'Ituri',     zone:'Bunia',            cases:31, deaths:5, cfr:16.1, status:'Active',    country:'DRC',    source:'ECDC 28 mai',  source_url:'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda' },
    { province:'Ituri',     zone:'Rwampara',         cases:20, deaths:3, cfr:15.0, status:'Active',    country:'DRC',    source:'WHO DON602',   source_url:'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON602' },
    { province:'Nord-Kivu', zone:'Butembo',          cases:9,  deaths:1, cfr:11.1, status:'Active',    country:'DRC',    source:'ECDC 28 mai',  source_url:'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda' },
    { province:'Nord-Kivu', zone:'Goma',             cases:5,  deaths:0, cfr:0,    status:'Monitoring',country:'DRC',    source:'ECDC 28 mai',  source_url:'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda' },
    { province:'Sud-Kivu',  zone:'Multiple',         cases:9,  deaths:0, cfr:0,    status:'Monitoring',country:'DRC',    source:'ECDC 28 mai',  source_url:'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda' },
    { province:'Uganda',    zone:'Kampala + autres', cases:9,  deaths:1, cfr:11.1, status:'Monitoring',country:'Uganda', source:'WHO DON603',   source_url:'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603' },
  ],
  trend: {
    source: 'WHO DON602/603 + ECDC — reconstruction depuis sitreps officiels',
    source_url: 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603',
    suspected_note: 'Variation suspects: ECDC (1 077 au 26 mai) vs MSF (906 au 28 mai)',
    dates:     ['15 mai','16 mai','17 mai','18 mai','19 mai','21 mai','22 mai','24 mai','26 mai','28 mai','29 mai'],
    confirmed: [8,8,10,13,22,31,40,51,70,121,125],
    suspected: [246,248,280,300,370,516,560,640,746,1077,906],
  },
  contact_tracing: {
    total_contacts_identified: 668,
    drc_contacts: 541,
    uganda_contacts: 127,
    source: 'WHO Situation Report — 18 mai 2026',
    source_url: 'https://www.who.int/emergencies/situations/ebola-outbreak---drc-2026',
    note: 'Répartition par zone de santé non disponible dans les rapports publics. Données nationales agrégées uniquement.',
    last_update: '2026-05-18',
  },
};

export default async function handler(req, res) {
  // Cache CDN Vercel: 4h
  res.setHeader('Cache-Control', 's-maxage=14400, stale-while-revalidate=28800');

  // Lecture depuis Supabase (snapshot le plus récent)
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
    console.warn('[ebola-data] Supabase unavailable, using fallback:', err.message);
    snapshot = FALLBACK_SNAPSHOT;
  }

  // Construire l'historique DRC avec le point 2026 dynamique
  const drcHistory = [
    ...DRC_HISTORY_BASE,
    {
      label: '2026 (cours)',
      cases: snapshot.confirmed_cases,
      deaths: snapshot.confirmed_deaths,
      cfr: snapshot.cfr_confirmed,
    },
  ];

  // Fusion données historiques + 2026 (pour la table globale)
  const allData = [
    ...HISTORICAL_DATA,
    { year:2026, country:'DRC',    cases:snapshot.confirmed_cases, deaths:snapshot.confirmed_deaths, cfr:snapshot.cfr_confirmed, species:'Bundibugyo', status:'Ongoing' },
    { year:2026, country:'Uganda', cases:snapshot.uganda_confirmed, deaths:snapshot.uganda_deaths, cfr:snapshot.uganda_confirmed ? parseFloat(((snapshot.uganda_deaths/snapshot.uganda_confirmed)*100).toFixed(1)) : 0, species:'Bundibugyo', status:'Ongoing' },
  ];

  res.status(200).json({
    success: true,
    generated_at: new Date().toISOString(),
    data_as_of: snapshot.data_as_of || snapshot.created_at,
    data_last_verified: snapshot.source || 'Voir metadata',
    data_source: supabaseError ? 'FALLBACK (Supabase indisponible)' : 'Supabase (auto-update)',
    supabase_error: supabaseError || null,

    disclaimer: "Outil d'aide \u00e0 la d\u00e9cision bas\u00e9 sur sources publiques officielles (WHO, ECDC, MSF). Ne remplace pas les SitReps officiels du Minist\u00e8re de la Sant\u00e9 de la RDC.",

    methodology: {
      cfr: "CFR = D\u00e9c\u00e8s confirm\u00e9s / Cas confirm\u00e9s \u00d7 100. Les d\u00e9c\u00e8s suspects ne sont PAS inclus dans le CFR confirm\u00e9.",
      rt: "R\u1d57 estim\u00e9 par EpiEstim (Cori et al. 2013). Intervalle s\u00e9riel BDBV \u2248 7 jours. IC 95%: [1.4\u20132.1]. Source: Imperial College London/WHO.",
      risk_scores: "\u00c9valuation QUALITATIVE bas\u00e9e sur ECDC Rapid Risk Assessment + WHO SitRep. Non quantitative officielle.",
    },

    outbreak_2026: {
      meta: {
        declaration_date: '2026-05-15',
        pheic_date: '2026-05-17',
        virus: 'Bundibugyo ebolavirus (BDBV)',
        outbreak_number: 17,
        no_approved_vaccine: true,
        index_case: 'Infirmi\u00e8re, Zone de sant\u00e9 de Mongbwalu, Ituri',
        last_data_update: snapshot.data_as_of || snapshot.created_at,
        last_verified_by: snapshot.source || 'Supabase auto-update',
        sources: [
          { name:'WHO DON603',       url:'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603',                                                                                date:'2026-05-20' },
          { name:'ECDC Weekly',      url:'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda',                                                     date:'2026-05-28' },
          { name:'MSF Briefing',     url:'https://www.msf.org/ebola-disease-drc-msf-scales-response-rapidly-evolving-outbreak',                                                                date:'2026-05-28' },
        ],
      },
      totals: {
        confirmed_cases:       snapshot.confirmed_cases,
        suspected_cases:       snapshot.suspected_cases,
        confirmed_deaths:      snapshot.confirmed_deaths,
        total_deaths_all:      snapshot.total_deaths_all,
        cfr_confirmed:         snapshot.cfr_confirmed,
        cfr_note:              snapshot.cfr_note,
        suspected_note:        snapshot.suspected_note,
        uganda_confirmed:      snapshot.uganda_confirmed,
        uganda_deaths:         snapshot.uganda_deaths,
        countries_affected:    snapshot.countries_affected,
        health_zones_affected: snapshot.health_zones_affected,
        source:                snapshot.source,
      },
      provinces:       snapshot.provinces,
      trend:           snapshot.trend,
      contact_tracing: snapshot.contact_tracing,
      rt:              RT_METADATA,
      risk_factors:    RISK_FACTORS_BASE,
    },

    historical:          allData,
    drc_history_comparison: drcHistory,
  });
}
