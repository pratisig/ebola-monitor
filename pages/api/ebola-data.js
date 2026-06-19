/**
 * /api/ebola-data — EBOLA-MONITOR v5.6.0
 *
 * CHANGELOG v5.6.0 (19/06/2026) — SitRep N°34 INSP (17/06/2026) enrichissement complet :
 *  Ajout décès + CFR par zone de santé (Tableau 2 SitRep N°34)
 *  Contacts détaillés par province : Ituri 4659 (suivi 70.8%), Nord-Kivu 1628 (70.5%), Sud-Kivu 80 (100%)
 *  Total contacts sous suivi : 6367, vus : 4525, taux : 71.1%
 *  Laboratoire : Ituri 126 éch. (positivité 12.7%), Nord-Kivu 70 éch. (positivité 7.1%), Sud-Kivu 2 éch. (100% négatifs)
 *  CTE : 383 patients en isolement, taux occupation 93.6% (Ituri 99.1%, Nord-Kivu 67.6%)
 *  Admissions 24h : 67 (Ituri 61, Nord-Kivu 6). Sorties : 40 (7 décès, 11 guéris, 18 non-cas, 3 évadés, 1 transféré)
 *  Alertes : 1028 remontées, 830 investiguées (80.7%). Alertes validées : 116 vivantes + 35 décédées = 151 suspects
 *  Taux d'investigation : Ituri 30.5%, Nord-Kivu 98.8%, Sud-Kivu 42.9%
 *  PoC Ituri : 43/55 activés (78.1%), 62104 voyageurs screenés (96%), 4 alertes notifiées
 *  56 cas probables en validation : Bunia(18), Rwampara(15), Nyankunde(6), Mongbwalu(6), Aru(3), Katwa(4), Lita(1), Mangala(1), Mambasa(1), Miti-Murhesa(1)
 *  Cas HCW : 75 (létalité 22.6%) — mis à jour depuis données PCI Nord-Kivu
 *  Principaux défis : 15 défis documentés dont gap financement 200M USD, saturation CTE Ituri (96.4%), ~350 cas non localisés
 *  zones_detail Ituri : décès et CFR complétés depuis Tableau 2
 *  zones_detail Nord-Kivu : décès et CFR complétés depuis Tableau 2
 *
 * CHANGELOG v5.5.0 (19/06/2026) — SitRep N°34 INSP (17/06/2026) :
 *  confirmed_cases : 837 → 896 (+59)
 *  confirmed_deaths: 196 → 232 (+36)
 *  CFR             : 23.4% → 26.3%
 *  health_zones    : 31 → 33 (+2 : Fataki en Ituri, Musienene en Nord-Kivu)
 *  Ituri : 763 → 817 cas, 20 → 21 ZS (nouvelle: Fataki)
 *  Nord-Kivu: 71 → 76 cas, 10 → 11 ZS (nouvelle: Musienene)
 *  Sud-Kivu: 3 cas / 1 décès — inchangé
 *
 * CHANGELOG v5.4.0 (18/06/2026) — SitRep N°33 INSP (16/06/2026) :
 *  confirmed_cases : 635 → 837 (+202)
 *  confirmed_deaths: 127 → 196 (+69)
 *  CFR             : 20.0% → 23.4%
 *  health_zones    : 26 → 31 (+5)
 * CHANGELOG v5.1.0 (11/06/2026) — SitRep N°26 INSP (09/06/2026).
 * CHANGELOG v5.0.1 (10/06/2026) — fix spread snapshot racine (compat dashboard).
 * CHANGELOG v5.0.0 (10/06/2026) — ECDC 10/06 + SitRep N°25 INSP (08/06).
 */

import { supabase } from '../../lib/supabase';
import { HISTORICAL_DATA, DRC_HISTORY_BASE, RT_METADATA, RISK_FACTORS_BASE } from '../../lib/historical-data';

const FALLBACK_STATIC_DATE = '2026-06-17T23:59:00Z';
const STALENESS_THRESHOLD_HOURS = 72;

async function fetchExternalSources() {
  const results = { reliefweb: null, who_afro: null };
  try {
    const rwRes = await fetch(
      'https://api.reliefweb.int/v1/reports?appname=ebola-monitor&filter[field]=primary_country.iso3&filter[value]=COD&filter[field2]=disease&filter[value2]=ebola&sort[]=date:desc&limit=3&fields[]=title&fields[]=date&fields[]=url',
      { signal: AbortSignal.timeout(4000) }
    );
    if (rwRes.ok) {
      const rwData = await rwRes.json();
      if (rwData?.data?.length > 0) {
        results.reliefweb = {
          latest_report_title: rwData.data[0]?.fields?.title || null,
          latest_report_date : rwData.data[0]?.fields?.date?.original || null,
          latest_report_url  : rwData.data[0]?.fields?.url || null,
          reports_count      : rwData.data.length,
        };
      }
    }
  } catch (_) {}
  try {
    const whoRes = await fetch(
      'https://www.afro.who.int/health-topics/ebola-virus-disease/feed',
      { signal: AbortSignal.timeout(4000) }
    );
    if (whoRes.ok) {
      const xml = await whoRes.text();
      const pubDateMatch = xml.match(/<pubDate>([^<]+)<\/pubDate>/);
      const titleMatch   = xml.match(/<item>[\s\S]*?<title>([^<]+)<\/title>/);
      if (pubDateMatch) {
        results.who_afro = {
          latest_pub_date : pubDateMatch[1]?.trim() || null,
          latest_title    : titleMatch?.[1]?.trim() || null,
        };
      }
    }
  } catch (_) {}
  return results;
}

const FALLBACK_SNAPSHOT = {
  confirmed_cases         : 896,
  suspected_cases         : 151,
  confirmed_deaths        : 232,
  total_deaths_all        : null,
  cfr_confirmed           : 26.3,
  recovered_estimated     : null,
  confirmed_active        : 78,
  // Uganda — inchangé (WHO ONU 18/06: 19 cas, 2 décès)
  uganda_confirmed        : 19,
  uganda_deaths           : 2,
  uganda_probable         : 1,
  uganda_probable_deaths  : 1,
  uganda_recovered        : 5,
  uganda_imported         : 14,
  uganda_local_transmission: 5,
  uganda_last_case_date   : '2026-06-05',
  uganda_days_no_new_case : 14,
  hcw_cases               : 75,
  hcw_deaths              : 17,
  hcw_cfr                 : 22.6,
  countries_affected      : 1,
  health_zones_affected   : 33,
  probable_cases_validation: 56,
  data_as_of              : FALLBACK_STATIC_DATE,
  source                  : 'INSP RDC SitRep MVE N°34/MVB_17/2026 — 17 juin 2026 [SOURCE OFFICIELLE]',
  source_url              : 'https://insp.cd/sitrep-n34-mvb_17-06-2026/',

  // Niveaux de risque WHO (ONU 18/06/2026 — concordance avec WHO DON)
  risk_levels: {
    drc                : 'très élevé',
    uganda             : 'élevé',
    border_countries   : 'élevé',
    africa_region      : 'faible',
    global             : 'faible',
    source             : 'WHO / ONU News 18 juin 2026',
    source_url         : 'https://news.un.org/en/story/2026/06/1167765',
  },

  // Plan continental WHO + Africa CDC (5 juin 2026)
  continental_plan: {
    launched_date      : '2026-06-05',
    budget_usd_million : 518,
    period             : 'juin–novembre 2026',
    source             : 'WHO + Africa CDC — 5 juin 2026',
    source_url         : 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON606',
  },

  contact_tracing: {
    suspects_en_investigation  : 151,
    suspects_deces_communaute  : 35,
    cas_probables_validation   : 56,
    confirmes_actifs_isolement : 78,
    total_en_isolement         : 383,
    isolement_confirmes        : 161,
    isolement_suspects         : 222,
    gueris_cumul               : null,
    gueris_du_jour             : 11,
    // Contacts détaillés par province (Tableau 4)
    contacts_sous_suivi        : 6367,
    contacts_vus_24h           : 4525,
    contact_tracing_rate_pct   : 71.1,
    contact_tracing_target_pct : 95.0,
    nouveaux_contacts_listes   : 319,
    // Alertes (Tableau 3)
    alertes_remontees_24h      : 1028,
    alertes_investiguees_24h   : 830,
    taux_investigation_pct     : 80.7,
    alertes_validees_vivantes  : 116,
    alertes_validees_decedees  : 35,
    suspects_du_jour           : 151,
    // Laboratoire (24h)
    echantillons_positifs_24h  : 21,
    echantillons_analyses_24h  : 198,
    taux_positivite_labo       : 10.6,
    // CTE (Tableau 6)
    cte_admissions_24h         : 67,
    cte_patients_lit_j1        : 356,
    cte_patients_lit_fin_j     : 383,
    cte_taux_occupation        : 93.6,
    cte_sorties_decedes        : 7,
    cte_sorties_non_cas        : 18,
    cte_sorties_gueris         : 11,
    cte_evades                 : 3,
    cte_transferes             : 1,
    source                     : 'INSP RDC N°34 (17 juin 2026) — 21 cas confirmés, 6 décès, 11 guéris, 383 en isolement (93.6%), suivi contacts 71.1% (6367 contacts)',
    source_date                : '2026-06-17',
    detail_provinces: {
      ituri    : { contacts: 4659, vus_24h: 3297, taux: 70.8, new_cases_24h: 16, new_deaths_24h: 4, alertes_remontees: 266, alertes_investiguees: 81, taux_investigation: 30.5, labo_echantillons: 126, labo_positifs: 16, labo_positivite: 12.7, cte_admissions: 61, cte_occupation: 99.1 },
      nord_kivu: { contacts: 1628, vus_24h: 1148, taux: 70.5, new_cases_24h: 5,  new_deaths_24h: 2, alertes_remontees: 755, alertes_investiguees: 746, taux_investigation: 98.8, labo_echantillons: 70, labo_positifs: 5, labo_positivite: 7.1, cte_admissions: 6, cte_occupation: 67.6 },
      sud_kivu : { contacts: 80,   vus_24h: 80,   taux: 100.0, new_cases_24h: 0,  new_deaths_24h: 0, alertes_remontees: 7, alertes_investiguees: 3, taux_investigation: 42.9, labo_echantillons: 2, labo_positifs: 0, labo_positivite: 0, cte_admissions: null, cte_occupation: null },
    },
  },

  trend: {
    source      : 'INSP RDC SitReps MVE N°001–034 PDF officiels',
    source_url  : 'https://insp.cd/',
    note        : 'Confirmés=cumulés. N°34 (17/06): 896 cas (+59 vs N°33), 232 décès (+36), CFR 26.3%. 33 ZS (2 nouvelles: Fataki en Ituri, Musienene en Nord-Kivu). Ituri 817 cas (91.2%), Nord-Kivu 76 (59.2% CFR), Sud-Kivu 3. 21 nouveaux cas/j, 11 guéris.',
    dates            : ['15 mai','17 mai','19 mai','21 mai','23 mai','26 mai','28 mai','01 juin (N017)','01 juin (N018)','02 juin (N019)','03 juin (N020)','04 juin (N021)','05 juin (N022)','06 juin (N023)','07 juin (N024)','08 juin (N025)','09 juin (N026)','10 juin (N027)','11 juin (N028)','12 juin (N029)','13 juin (N030)','14 juin (N031)','15 juin (N032)','16 juin (N033)','17 juin (N034)'],
    confirmed        : [8,       10,      22,      31,      101,     121,     125,     321,             344,             363,             381,             430,             470,             515,             550,             598,             635,             676,             710,             710,             782,             808,             null,            837,            896],
    suspected_active : [null,    null,    null,    null,    null,    null,    null,    104,             116,             116,             171,             180,             185,             190,             193,             193,             143,             null,            null,            null,            null,            null,            null,            null,            151],
    deaths_conf      : [1,       2,       5,       7,       null,    17,      17,      48,              60,              62,              64,              76,              86,              94,              101,             115,             127,             136,             149,             149,             166,             192,             null,            196,            232],
    recovered        : [0,       0,       0,       0,       null,    0,       0,       6,               6,               7,               7,               10,              12,              12,              19,              22,              30,              null,            null,            null,            null,            null,            null,            null,            null],
    new_cases_24h    : [null,    null,    null,    null,    null,    null,    null,    12,              23,              19,              18,              49,              40,              45,              35,              48,              37,              null,            21,              null,            72,              null,            null,            29,             21],
  },

  provinces: [
    {
      province      : 'Ituri',
      cases         : 817,
      deaths        : 186,
      cfr           : 22.8,
      zones_touchees: 21,
      new_cases_24h : 16,
      new_deaths_24h: 4,
      country       : 'DRC',
      source        : 'INSP N°34 (17/06/2026)',
      source_date   : '2026-06-17',
      epicentre     : true,
      pct_total_cases: 91.2,
      zones: [
        'Aru','Aungba','Bambu','Bunia','Damas','Fataki','Gety','Kilo','Kambala',
        'Komanda','Lita','Logo','Mambasa','Mangala','Mongbwalu',
        'Nia-Nia','Nizi','Nyankunde','Rimba','Rwampara','Tchomia'
      ],
      zones_detail: [
        { zone:'Bunia',     cases:247, deaths:41,  cfr:16.6 },
        { zone:'Rwampara',  cases:195, deaths:33,  cfr:16.9 },
        { zone:'Mongbwalu', cases:189, deaths:83,  cfr:43.9 },
        { zone:'Nyankunde', cases:68,  deaths:6,   cfr:8.8  },
        { zone:'Nizi',      cases:25,  deaths:5,   cfr:20.0 },
        { zone:'Lita',      cases:18,  deaths:4,   cfr:22.2 },
        { zone:'Komanda',   cases:10,  deaths:3,   cfr:30.0 },
        { zone:'Bambu',     cases:9,   deaths:2,   cfr:22.2 },
        { zone:'Kilo',      cases:7,   deaths:1,   cfr:14.3 },
        { zone:'Mangala',   cases:5,   deaths:3,   cfr:60.0 },
        { zone:'Tchomia',   cases:5,   deaths:0,   cfr:0.0  },
        { zone:'Damas',     cases:4,   deaths:0,   cfr:0.0  },
        { zone:'Aungba',    cases:4,   deaths:1,   cfr:25.0 },
        { zone:'Rimba',     cases:3,   deaths:0,   cfr:0.0  },
        { zone:'Aru',       cases:3,   deaths:1,   cfr:33.3 },
        { zone:'Mambasa',   cases:2,   deaths:1,   cfr:50.0 },
        { zone:'Logo',      cases:2,   deaths:0,   cfr:0.0  },
        { zone:'Drodro',    cases:1,   deaths:1,   cfr:100.0 },
        { zone:'Gety',      cases:1,   deaths:0,   cfr:0.0  },
        { zone:'Kambala',   cases:1,   deaths:1,   cfr:100.0 },
        { zone:'Nia-Nia',   cases:1,   deaths:1,   cfr:100.0 },
        { zone:'Fataki',    cases:1,   deaths:0,   cfr:0.0  }, // Nouvelle ZS N°34
        { zone:'Autres (non ventilés)', cases:17, deaths:0, cfr:0.0 },
      ],
      note: 'N°34 (17/06): 817 cas (21 ZS, ~91.2% du total). Nouvelle ZS: Fataki. Zones actives 24h: Bunia(4), Mongbwalu(4), Nizi(2), Lita(2), Komanda(1), Mangala(1), Nyankunde(1), Kilo(1). Mongbwalu: CFR 43.9% — défis PEC précoce. CTE Ituri: 99.1% occupation (saturation critique).',
    },
    {
      province      : 'Nord-Kivu',
      cases         : 76,
      deaths        : 45,
      cfr           : 59.2,
      zones_touchees: 11,
      new_cases_24h : 5,
      new_deaths_24h: 2,
      country       : 'DRC',
      source        : 'INSP N°34 (17/06/2026)',
      source_date   : '2026-06-17',
      note          : 'N°34: 76 cas, 11/34 ZS. Nouvelle ZS: Musienene. CFR 59.2% — létalité très élevée (insécurité ADF, délais PEC, évasions CTE). Zones actives 24h: Beni(2), Katwa(2), Butembo(1). 3 prestataires santé placés en isolement. CTE: 67.6% occupation.',
      zones: [
        'Beni','Butembo','Goma','Kalunguta','Katwa',
        'Kyondo','Mabalako','Masereka','Musienene','Oicha','Vuhovi'
      ],
      zones_detail: [
        { zone:'Butembo',   cases:25, deaths:11, cfr:44.0  },
        { zone:'Katwa',     cases:24, deaths:16, cfr:66.7  },
        { zone:'Beni',      cases:15, deaths:12, cfr:80.0  },
        { zone:'Oicha',     cases:3,  deaths:2,  cfr:66.7  },
        { zone:'Kalunguta', cases:2,  deaths:1,  cfr:50.0  },
        { zone:'Kyondo',    cases:2,  deaths:1,  cfr:50.0  },
        { zone:'Goma',      cases:1,  deaths:0,  cfr:0.0   },
        { zone:'Masereka',  cases:1,  deaths:0,  cfr:0.0   },
        { zone:'Vuhovi',    cases:1,  deaths:1,  cfr:100.0 },
        { zone:'Mabalako',  cases:1,  deaths:0,  cfr:0.0   },
        { zone:'Musienene', cases:1,  deaths:1,  cfr:100.0 }, // Nouvelle ZS N°34
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
      source        : 'INSP N°34 (inchangé)',
      source_date   : '2026-06-17',
      note          : 'Dernier cas confirmé : 26 mai 2026. Inchangé depuis N°20. Pas de transmission active. Vigilance maintenue. 1 cas probable en validation (Miti-Murhesa).',
      zones: ['Miti-Murhesa'],
      zones_detail: [
        { zone:'Miti-Murhesa', cases:3, deaths:1, cfr:33.3 },
      ],
    },
    {
      province      : 'Uganda',
      cases         : 19,
      deaths        : 2,
      cfr           : 10.5,
      zones_touchees: 2,
      new_cases_24h : 0,
      country       : 'Uganda',
      source        : 'WHO / ONU News 18 juin 2026',
      source_date   : '2026-06-18',
      zones: ['Kampala (8 cas)', 'Wakiso (1 cas)'],
      last_case_date: '2026-06-05',
      consecutive_days_no_new_case: 14,
      note: '19 cas: 14 importés RDC (~70% Congolais cherchant soins), 5 transmission locale. 2 décès (cas importés). 5 guéris. DERNIER CAS : 05 juin 2026. 14 jours consécutifs sans nouveau cas au 19/06. Pas de transmission communautaire. Données confirmées ONU/WHO 18/06.',
    },
  ],

  // Cas probables en validation (SitRep N°34)
  probable_cases_detail: [
    { zone:'Bunia',        province:'Ituri',     count:18 },
    { zone:'Rwampara',     province:'Ituri',     count:15 },
    { zone:'Nyankunde',    province:'Ituri',     count:6  },
    { zone:'Mongbwalu',    province:'Ituri',     count:6  },
    { zone:'Aru',          province:'Ituri',     count:3  },
    { zone:'Katwa',        province:'Nord-Kivu', count:4  },
    { zone:'Lita',         province:'Ituri',     count:1  },
    { zone:'Mangala',      province:'Ituri',     count:1  },
    { zone:'Mambasa',      province:'Ituri',     count:1  },
    { zone:'Miti-Murhesa', province:'Sud-Kivu',  count:1  },
  ],

  // Points d'entrée/contrôle Ituri (Tableau 5)
  points_controle: {
    province          : 'Ituri',
    poc_actives       : 43,
    poc_total         : 55,
    poc_taux          : 78.1,
    voyageurs_passes  : 62104,
    pct_screnes       : 96.0,
    pct_lave_mains    : 93.8,
    pct_sensibilises  : 91.0,
    alertes_notifiees : 4,
    alertes_investiguees_pct: 100.0,
    resultats_dispo_24h_pct : 75.0,
    contacts_interceptes    : 0,
    source_date       : '2026-06-17',
  },

  // Défis opérationnels majeurs (SitRep N°34 — Section 5)
  operational_challenges: [
    { id:1,  defi:'Réticence prélèvements post-mortem (EDS/swabs) et résistance communautaire', impact:'Retard confirmation, sous-estimation cas, perturbation activités', action:'Intensifier CREC, implication leaders religieux, renforcement sécurité équipes' },
    { id:2,  defi:'Capacité insuffisante CTE et saturation Ituri (99.1%)', impact:'Retards admission, risque transmission nosocomiale', action:'Accélérer construction/expansion CTE, structures temporaires supplémentaires' },
    { id:3,  defi:'Faible suivi contacts (71.1% vs cible 95%)', impact:'Chaînes de transmission non interrompues', action:'Former, déployer et motiver RECO, supervision renforcée' },
    { id:4,  defi:'Surveillance insuffisante (30.5% alertes investiguées en Ituri)', impact:'Transmission non détectée, expansion silencieuse', action:'Renforcer surveillance communautaire, améliorer remontée et investigation rapide' },
    { id:5,  defi:'~350 cas non localisés ou non classifiés', impact:'Lacunes majeures dans reconstruction chaînes de transmission', action:'Réconciliation données, élimination doublons, reclassification ZS et statuts' },
    { id:6,  defi:'Insuffisance approvisionnement MEG et intrants médicaux', impact:'Fragilisation prise en charge globale', action:'Plaidoyer et approvisionnement urgent médicaments essentiels' },
    { id:7,  defi:'Insuffisance intrants PCI (EPI, chlore) et formation limitée', impact:'Risque élevé infections nosocomiales (75 cas HCW, létalité 22.6%)', action:'Approvisionnement urgent, renforcement formations PCI' },
    { id:8,  defi:'Backlog échantillons laboratoire Nord-Kivu, diagnostic tardif', impact:'Retard confirmation, létalité élevée (59.2%)', action:'Plan de rattrapage laboratoire, renforcement capacités diagnostiques' },
    { id:9,  defi:'Insuffisance ambulances et structures isolement (gap 20 centres)', impact:'Retards transfert, augmentation risque transmission', action:'Déploiement urgent moyens logistiques et infrastructures' },
    { id:10, defi:'Coordination insuffisante, faible utilisation cadres COUSP', impact:'Inefficience opérationnelle, décisions retardées', action:'Renforcer mécanismes coordination tous niveaux, opérationnaliser COUSP' },
    { id:11, defi:'Insuffisance ressources financières (gap 200 millions USD)', impact:'Limitation mise en œuvre tous piliers riposte', action:'Mobilisation urgente ressources, plaidoyer partenaires' },
    { id:12, defi:'Insécurité et accès limité (CODECO, ADF)', impact:'Restriction opérations, accès limité zones à haut risque', action:'Renforcement coordination sécuritaire et accès humanitaire' },
    { id:13, defi:'Faible remontée alertes (notamment Sud-Kivu)', impact:'Retard détection cas', action:'Renforcement surveillance communautaire et système alerte' },
    { id:14, defi:'Continuité services essentiels (CEHS) compromise', impact:'Augmentation mortalité indirecte (non Ebola)', action:'Mise en œuvre effective gratuité soins, renforcement CEHS' },
    { id:15, defi:'Forte mobilité des populations', impact:'Risque élevé expansion géographique rapide', action:'Renforcer surveillance aux PoE/PoC et coordination transfrontalière' },
  ],

  sources_comparison: [
    {
      name            : 'INSP RDC SitRep N°34/MVB_17/2026 (source primaire officielle)',
      date            : '2026-06-17',
      confirmed_cases : 896,
      suspected_cases : 151,
      confirmed_deaths: 232,
      confirmed_active: 383,
      confirmed_recovered: null,
      contact_tracing_rate_pct: 71.1,
      health_zones    : 33,
      new_cases_24h   : 21,
      note            : 'SOURCE OFFICIELLE RDC (17/06). 896 cas cumulés (+59 vs N°33), 232 décès (+36), CFR 26.3%. 2 nouvelles ZS: Fataki (Ituri), Musienene (Nord-Kivu). Total 33/104 ZS touchées. 383 en isolement (93.6%). Suivi contacts 71.1% (6367 contacts). 1028 alertes remontées.',
      url             : 'https://insp.cd/sitrep-n34-mvb_17-06-2026/',
      is_primary      : true,
    },
    {
      name            : 'WHO / ONU News (18 juin 2026)',
      date            : '2026-06-18',
      confirmed_cases : 896,
      confirmed_deaths: 232,
      uganda_confirmed: 19,
      uganda_deaths   : 2,
      health_zones    : 31,
      note            : '896 cas confirmés et 232 décès au 17 juin (DRC). Uganda: 19 cas, 2 décès. ONU/WHO avertit d\'une accélération de la propagation dans un contexte de violence armée continue. Risque régional grave et croissant.',
      url             : 'https://news.un.org/en/story/2026/06/1167765',
    },
    {
      name            : 'ECDC (17 juin 2026)',
      date            : '2026-06-17',
      confirmed_cases : null,
      confirmed_deaths: null,
      note            : 'ECDC déploie des experts supplémentaires sur le terrain cette semaine pour renforcer l\'assistance et les activités d\'évaluation des risques. Risque d\'importation dans EU/EEA : très faible selon nouvelle évaluation. Aucun cas confirmé ou importé en Europe au 17/06.',
      url             : 'https://www.ecdc.europa.eu/en/news-events/ebola-outbreak-drc-and-uganda-ecdc-scales-support-ground',
    },
    {
      name            : 'MSF (14–15 juin 2026 — 1 mois après déclaration)',
      date            : '2026-06-14',
      confirmed_cases : null,
      confirmed_deaths: null,
      contact_tracing_rate_pct: 56,
      note            : 'MSF alerte: lacunes dangereuses persistent après 1 mois. Taux contacts <56% (cible OMS: 90–95%). CTE 65 lits en construction à Bunia (Ituri). Ituri: ~95% des cas. Transmission active Ituri et Nord-Kivu. Urgence escalade de la réponse.',
      url             : 'https://msfsouthasia.org/drc-one-month-msf-warns-dangerous-gaps-persist-in-ebola-disease-response/',
    },
    {
      name            : 'Conseil EU — ECDC/Commission (8 juin 2026)',
      date            : '2026-06-08',
      confirmed_cases : 550,
      confirmed_deaths: 101,
      confirmed_active: 309,
      note            : 'Au 8/06: 550 cas, 101 décès, 309 hospitalisés en isolement. ECDC: risque pour population EU/EEA très faible. Zéro cas confirmé ou importé en Europe.',
      url             : 'https://data.consilium.europa.eu/doc/document/ST-10271-2026-INIT/en/pdf',
    },
    {
      name            : 'INSP RDC SitRep N°33/MVB_16/2026',
      date            : '2026-06-16',
      confirmed_cases : 837,
      suspected_cases : null,
      confirmed_deaths: 196,
      confirmed_active: null,
      confirmed_recovered: null,
      contact_tracing_rate_pct: null,
      health_zones    : 31,
      new_cases_24h   : 29,
      note            : 'N°33 (16/06): 837 cas, 196 décès, CFR 23.4%, 31 ZS. Ituri 763 (20 ZS), Nord-Kivu 71 (10 ZS), Sud-Kivu 3.',
      url             : 'https://insp.cd/sitrep-n33-mvb_16-06-2026/',
    },
    {
      name            : 'WHO DON606 (6 juin 2026)',
      date            : '2026-06-06',
      confirmed_cases : 515,
      confirmed_deaths: 91,
      total_both_countries_cases: 534,
      total_both_countries_deaths: 93,
      uganda_confirmed: 19,
      uganda_deaths   : 2,
      hcw_cases       : 16,
      contacts_identified: 5040,
      note            : 'DRC: 515 cas, 91 décès, CFR 17.7%, 25 ZS. Uganda: 19 cas, 2 décès, 5 guéris. Total combiné: 534 cas, 93 décès. Plan continental 518M USD lancé 5/06.',
      url             : 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON606',
    },
  ],

  source_discrepancies: {
    title: 'Pourquoi les chiffres diffèrent entre sources ?',
    reasons: [
      { label: 'INSP N°34 (17/06) = source primaire officielle RDC la plus récente',
        detail: '896 cas, 232 décès, CFR 26.3%, 33 ZS. Ituri: 817 cas (21 ZS, 91.2%), Nord-Kivu: 76 cas (11 ZS, CFR 59.2%), Sud-Kivu: 3 cas. +59 cas et +36 décès en 24h vs N°33. Concordance parfaite avec ONU/WHO 18/06.' },
      { label: 'CFR en hausse brutale : 23.4% (N°33) → 26.3% (N°34)',
        detail: 'Augmentation de +2.9 points en 24h. Nord-Kivu: CFR 59.2% (45 décès / 76 cas) — létalité extrêmement élevée liée à l\'insécurité ADF, aux délais de prise en charge et aux évasions des CTE. Alertes MSF sur les lacunes de la réponse.' },
      { label: '2 nouvelles zones de santé touchées vs N°33',
        detail: 'Fataki (Ituri, 21 ZS); Musienene (Nord-Kivu, 11 ZS). Total: 33/104 ZS en 3 provinces.' },
      { label: 'MSF alerte sur le taux de suivi des contacts',
        detail: 'Taux de suivi contacts: 71.1% (INSP N°34) vs <56% selon MSF (14/06). Cible OMS: 90–95%. Écart entre données officielles et terrain MSF reflète des méthodologies différentes et des zones inaccessibles.' },
      { label: 'Uganda — 14 jours sans nouveau cas au 19/06',
        detail: '19 cas: 14 importés RDC, 5 transmission locale. 2 décès. 5 guéris. Dernier cas: 05/06/2026. Si 42 jours sans nouveau cas confirmés → fin d\'épidémie Uganda (date cible: 17 juillet 2026).' },
      { label: 'ECDC — risque EU très faible, renforcement sur le terrain',
        detail: 'ECDC déploie experts supplémentaires semaine du 17/06. Nouvelle évaluation: risque importation EU/EEA très faible. Zéro cas en Europe. Mesures de précaution recommandées pour voyageurs en zone affectée.' },
    ],
    consensus: 'INSP N°34 (17/06) [confirmé WHO/ONU 18/06]: DRC 896 cas, 232 décès, CFR 26.3%, 33 ZS. Ituri 817 (21 ZS, 91.2%), Nord-Kivu 76 (11 ZS, CFR 59.2%), Sud-Kivu 3. Uganda: 19 cas, 2 décès, 0 nouveau depuis 14 jours.',
  },
};

function parseField(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return null; } }
  return val;
}

function shouldUseSupabase(rawDataAsOf) {
  if (!rawDataAsOf) return false;
  return new Date(rawDataAsOf) > new Date(FALLBACK_STATIC_DATE);
}

function isSupabaseDataSane(raw) {
  // Baseline N°34: 896 cas — rejeter toute donnée Supabase inférieure ou invalide
  if (!raw.confirmed_cases || raw.confirmed_cases < 896) return false;
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
    uganda_probable         : raw.uganda_probable         ?? FALLBACK_SNAPSHOT.uganda_probable,
    uganda_probable_deaths  : raw.uganda_probable_deaths  ?? FALLBACK_SNAPSHOT.uganda_probable_deaths,
    uganda_recovered        : raw.uganda_recovered        ?? FALLBACK_SNAPSHOT.uganda_recovered,
    uganda_imported         : raw.uganda_imported         ?? FALLBACK_SNAPSHOT.uganda_imported,
    uganda_local_transmission: raw.uganda_local_transmission ?? FALLBACK_SNAPSHOT.uganda_local_transmission,
    uganda_last_case_date   : raw.uganda_last_case_date   ?? FALLBACK_SNAPSHOT.uganda_last_case_date,
    uganda_days_no_new_case : raw.uganda_days_no_new_case ?? FALLBACK_SNAPSHOT.uganda_days_no_new_case,
    hcw_cases               : raw.hcw_cases               ?? FALLBACK_SNAPSHOT.hcw_cases,
    hcw_deaths              : raw.hcw_deaths              ?? FALLBACK_SNAPSHOT.hcw_deaths,
    hcw_cfr                 : raw.hcw_cfr                 ?? FALLBACK_SNAPSHOT.hcw_cfr,
    countries_affected      : raw.countries_affected      ?? FALLBACK_SNAPSHOT.countries_affected,
    health_zones_affected   : raw.health_zones_affected   ?? FALLBACK_SNAPSHOT.health_zones_affected,
    probable_cases_validation: raw.probable_cases_validation ?? FALLBACK_SNAPSHOT.probable_cases_validation,
    data_as_of              : raw.data_as_of              || FALLBACK_SNAPSHOT.data_as_of,
    source                  : raw.source                  || FALLBACK_SNAPSHOT.source,
    source_url              : raw.source_url              || FALLBACK_SNAPSHOT.source_url,
    risk_levels             : FALLBACK_SNAPSHOT.risk_levels,
    continental_plan        : FALLBACK_SNAPSHOT.continental_plan,
    probable_cases_detail   : FALLBACK_SNAPSHOT.probable_cases_detail,
    points_controle         : FALLBACK_SNAPSHOT.points_controle,
    operational_challenges  : FALLBACK_SNAPSHOT.operational_challenges,
    provinces               : (provinces && Array.isArray(provinces) && provinces.length) ? provinces : FALLBACK_SNAPSHOT.provinces,
    trend                   : normalizedTrend || FALLBACK_SNAPSHOT.trend,
    contact_tracing         : (contact_tracing && contact_tracing.contact_tracing_rate_pct != null) ? contact_tracing : FALLBACK_SNAPSHOT.contact_tracing,
    sources_comparison      : (sources_comparison && Array.isArray(sources_comparison) && sources_comparison.length) ? sources_comparison : FALLBACK_SNAPSHOT.sources_comparison,
    source_discrepancies    : (source_discrepancies && source_discrepancies.title) ? source_discrepancies : FALLBACK_SNAPSHOT.source_discrepancies,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  let rawSnapshot = null;
  let supabaseError = null;
  let supabaseSkipped = false;

  const [supabaseResult, externalSources] = await Promise.allSettled([
    supabase
      .from('outbreak_snapshots')
      .select('*')
      .neq('parse_confidence', 'auto_invalid')
      .order('data_as_of', { ascending: false })
      .limit(1)
      .single(),
    fetchExternalSources(),
  ]);

  if (supabaseResult.status === 'fulfilled') {
    const { data, error } = supabaseResult.value;
    if (error) {
      supabaseError = error.message;
    } else if (data && shouldUseSupabase(data.data_as_of) && isSupabaseDataSane(data)) {
      rawSnapshot = data;
    } else {
      supabaseSkipped = true;
      supabaseError = `Supabase row skipped: date=${data?.data_as_of}, cases=${data?.confirmed_cases} — not newer/sane vs fallback (${FALLBACK_STATIC_DATE}, baseline 896 cas)`;
    }
  } else {
    supabaseError = supabaseResult.reason?.message || 'Supabase call failed';
  }

  const extSources = externalSources.status === 'fulfilled' ? externalSources.value : { reliefweb: null, who_afro: null };

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

  const generatedAt = new Date().toISOString();

  const snapshotWithActive = { ...snapshot, confirmed_active: confirmedActive };

  res.status(200).json({
    // === CHAMPS RACINE (compat dashboard) ===
    ...snapshotWithActive,

    // === MÉTADONNÉES ===
    success       : true,
    generated_at  : generatedAt,
    data_as_of    : snapshot.data_as_of,
    data_source   : rawSnapshot
      ? 'Supabase'
      : (supabaseSkipped ? 'FALLBACK_STATIC (Supabase not newer/sane)' : 'FALLBACK_STATIC (Supabase error)'),
    primary_source: 'INSP RDC — https://insp.cd/sitrep-n34-mvb_17-06-2026/',
    supabase_error: supabaseError || null,

    staleness: {
      check_field           : 'generated_at',
      threshold_hours       : STALENESS_THRESHOLD_HOURS,
      data_as_of_iso        : snapshot.data_as_of,
      data_age_hours        : Math.round((Date.now() - new Date(snapshot.data_as_of)) / 3600000),
      note                  : 'data_as_of = date de la dernière source officielle (INSP N°34 17/06). Seuil alerte: 72h.',
    },

    // === CLÉ IMBRIQUÉE (compat nouveaux clients) ===
    snapshot: snapshotWithActive,

    risk_factors     : RISK_FACTORS_BASE,
    rt_metadata      : RT_METADATA,
    drc_history      : drcHistory,
    all_outbreaks    : allData,
    external_sources : extSources,

    meta: {
      version       : '5.6.0',
      sitrep        : 'N°34/MVB_17/06/2026',
      sources_used  : [
        'INSP RDC N°34 (17/06/2026)',
        'WHO / ONU News 18/06/2026',
        'ECDC 17/06/2026',
        'MSF 14/06/2026',
        'Conseil EU — ECDC 8/06/2026',
      ],
      note          : 'N°34 enrichi (19/06): 896 cas, 232 décès, CFR 26.3%, 33 ZS. Ituri 817 (21 ZS, 91.2%, CTE 99.1%), Nord-Kivu 76 (11 ZS, CFR 59.2%, CTE 67.6%), Sud-Kivu 3. 21 nouveaux cas/j, 11 guéris, 383 en isolement (93.6%), 6367 contacts (71.1%). 1028 alertes, 80.7% investiguées. Ituri: 30.5% alertes investiguées (défi majeur). Labo: Ituri 12.7%, NK 7.1%. 15 défis opérationnels documentés dont gap 200M USD. 75 cas HCW (CFR 22.6%). Uganda: 14j sans nouveau cas.',
    },
  });
}
