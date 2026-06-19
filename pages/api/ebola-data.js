/**
 * /api/ebola-data — EBOLA-MONITOR v5.5.0
 *
 * CHANGELOG v5.5.0 (19/06/2026) — SitRep N°34 INSP (17/06/2026) :
 *  confirmed_cases : 837 → 896 (+59)
 *  confirmed_deaths: 196 → 232 (+36)
 *  CFR             : 23.4% → 26.3%
 *  health_zones    : 31 → 33 (+2 : Fataki en Ituri, Musienene en Nord-Kivu)
 *  Ituri : 763 → 817 cas, 20 → 21 ZS (nouvelle: Fataki)
 *  Nord-Kivu: 71 → 76 cas, 10 → 11 ZS (nouvelle: Musienene)
 *  Sud-Kivu: 3 cas / 1 décès — inchangé
 *  Nouveaux cas 24h : 21 (Ituri 16, Nord-Kivu 5)
 *  Guéris du jour : 11
 *  Cas suspects du jour : 151 (dont 35 décès)
 *  Cas probables en validation : 56
 *  Patients en isolement/hospitalisation : 78
 *  Taux de suivi des contacts (3 provinces) : 71.1%
 *  Uganda : 19 cas / 2 décès — inchangé (WHO/ONU 17/06)
 *  WHO (ONU 18/06): 896 cas, 232 décès confirmés au 17/06 — concordance parfaite avec INSP N°34
 *  ECDC (17/06): déploiement d'experts supplémentaires sur le terrain, risque EU/EEA très faible
 *  MSF (14/06): lacunes dangereuses persistent — CTE 65 lits en construction Bunia, taux suivi contacts <56%
 *  isSupabaseDataSane baseline relevée à 896
 *  FALLBACK_STATIC_DATE mis à jour au 17/06
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
  hcw_cases               : 16,
  countries_affected      : 1,
  health_zones_affected   : 33,
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
    total_en_isolement         : 78,
    gueris_cumul               : null,
    contacts_sous_suivi        : null,
    contacts_vus_24h           : null,
    contact_tracing_rate_pct   : 71.1,
    contact_tracing_target_pct : 95.0,
    alertes_remontees_24h      : null,
    alertes_investiguees_24h   : null,
    taux_investigation_pct     : null,
    suspects_du_jour           : 151,
    echantillons_positifs_24h  : 21,
    echantillons_analyses_24h  : null,
    taux_positivite_labo       : null,
    source                     : 'INSP RDC N°34 (17 juin 2026) — 21 cas confirmés, 6 décès, 11 guéris, 78 en isolement, taux contacts 71.1%',
    source_date                : '2026-06-17',
    detail_provinces: {
      ituri    : { contacts: null, vus_24h: null, taux: null, new_cases_24h: 16, new_deaths_24h: 4 },
      nord_kivu: { contacts: null, vus_24h: null, taux: null, new_cases_24h: 5,  new_deaths_24h: 2 },
      sud_kivu : { contacts: null, vus_24h: null, taux: null, new_cases_24h: 0,  new_deaths_24h: 0 },
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
        { zone:'Bunia',     cases:247, deaths:null, cfr:null },
        { zone:'Rwampara',  cases:195, deaths:null, cfr:null },
        { zone:'Mongbwalu', cases:189, deaths:null, cfr:null },
        { zone:'Nyankunde', cases:68,  deaths:null, cfr:null },
        { zone:'Nizi',      cases:25,  deaths:null, cfr:null },
        { zone:'Lita',      cases:18,  deaths:null, cfr:null },
        { zone:'Komanda',   cases:10,  deaths:null, cfr:null },
        { zone:'Bambu',     cases:9,   deaths:null, cfr:null },
        { zone:'Kilo',      cases:7,   deaths:null, cfr:null },
        { zone:'Mangala',   cases:5,   deaths:null, cfr:null },
        { zone:'Tchomia',   cases:5,   deaths:null, cfr:null },
        { zone:'Damas',     cases:4,   deaths:null, cfr:null },
        { zone:'Aungba',    cases:4,   deaths:null, cfr:null },
        { zone:'Rimba',     cases:3,   deaths:null, cfr:null },
        { zone:'Aru',       cases:3,   deaths:null, cfr:null },
        { zone:'Mambasa',   cases:2,   deaths:null, cfr:null },
        { zone:'Logo',      cases:2,   deaths:null, cfr:null },
        { zone:'Gety',      cases:1,   deaths:null, cfr:null },
        { zone:'Kambala',   cases:1,   deaths:null, cfr:null },
        { zone:'Nia-Nia',   cases:1,   deaths:null, cfr:null },
        { zone:'Fataki',    cases:null, deaths:null, cfr:null }, // Nouvelle ZS N°34
      ],
      note: 'N°34 (17/06): 817 cas (21 ZS, ~91.2% du total). Nouvelle ZS: Fataki. Nouvelles zones actives 24h: Bunia(4), Mongbwalu(4), Nizi(2), Lita(2), Komanda(1), Mangala(1), Nyankunde(1), Kilo(1). Ventilation détaillée par ZS au 18/06/2026 (cumul).',
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
      note          : 'N°34: 76 cas, 11/34 ZS. Nouvelle ZS: Musienene. CFR 59.2% — létalité très élevée (insécurité ADF, délais PEC, évasions CTE). Nouvelles zones actives 24h: Beni(2), Katwa(2), Butembo(1).',
      zones: [
        'Beni','Butembo','Goma','Kalunguta','Katwa',
        'Kyondo','Mabalako','Masereka','Musienene','Oicha','Vuhovi'
      ],
      zones_detail: [
        { zone:'Butembo',  cases:25, deaths:null, cfr:null },
        { zone:'Katwa',    cases:24, deaths:null, cfr:null },
        { zone:'Beni',     cases:15, deaths:null, cfr:null },
        { zone:'Oicha',    cases:3,  deaths:null, cfr:null },
        { zone:'Kalunguta',cases:2,  deaths:null, cfr:null },
        { zone:'Kyondo',   cases:2,  deaths:null, cfr:null },
        { zone:'Goma',     cases:1,  deaths:null, cfr:null },
        { zone:'Masereka', cases:1,  deaths:null, cfr:null },
        { zone:'Vuhovi',   cases:1,  deaths:null, cfr:null },
        { zone:'Mabalako', cases:1,  deaths:null, cfr:null },
        { zone:'Musienene',cases:1,  deaths:null, cfr:null }, // Nouvelle ZS N°34
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
      note          : 'Dernier cas confirmé : 26 mai 2026. Inchangé depuis N°20. Pas de transmission active. Vigilance maintenue.',
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

  sources_comparison: [
    {
      name            : 'INSP RDC SitRep N°34/MVB_17/2026 (source primaire officielle)',
      date            : '2026-06-17',
      confirmed_cases : 896,
      suspected_cases : 151,
      confirmed_deaths: 232,
      confirmed_active: 78,
      confirmed_recovered: null,
      contact_tracing_rate_pct: 71.1,
      health_zones    : 33,
      new_cases_24h   : 21,
      note            : 'SOURCE OFFICIELLE RDC (17/06). 896 cas cumulés (+59 vs N°33), 232 décès (+36), CFR 26.3%. 2 nouvelles ZS: Fataki (Ituri), Musienene (Nord-Kivu). Total 33/104 ZS touchées. 78 en isolement. Suivi contacts 71.1%.',
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
      url             : 'https://msfsouthasia.org/drc-one-month-on-msf-warns-dangerous-gaps-persist-in-ebola-disease-response/',
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
    countries_affected      : raw.countries_affected      ?? FALLBACK_SNAPSHOT.countries_affected,
    health_zones_affected   : raw.health_zones_affected   ?? FALLBACK_SNAPSHOT.health_zones_affected,
    data_as_of              : raw.data_as_of              || FALLBACK_SNAPSHOT.data_as_of,
    source                  : raw.source                  || FALLBACK_SNAPSHOT.source,
    source_url              : raw.source_url              || FALLBACK_SNAPSHOT.source_url,
    risk_levels             : FALLBACK_SNAPSHOT.risk_levels,
    continental_plan        : FALLBACK_SNAPSHOT.continental_plan,
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
      version       : '5.5.0',
      sitrep        : 'N°34/MVB_17/06/2026',
      sources_used  : [
        'INSP RDC N°34 (17/06/2026)',
        'WHO / ONU News 18/06/2026',
        'ECDC 17/06/2026',
        'MSF 14/06/2026',
        'Conseil EU — ECDC 8/06/2026',
      ],
      note          : 'N°34 (17/06): 896 cas (+59 vs N°33), 232 décès (+36), CFR 26.3%, 33 ZS (Fataki+Musienene nouvelles). Ituri 817 (21 ZS, 91.2%), Nord-Kivu 76 (11 ZS, CFR 59.2%), Sud-Kivu 3. 21 nouveaux cas/j, 11 guéris, 78 en isolement, suivi contacts 71.1%. Uganda: 14 jours sans nouveau cas. WHO/ONU 18/06: concordance parfaite. ECDC: experts déployés, risque EU très faible. MSF: alerte lacunes persistantes, CTE 65 lits en construction.',
    },
  });
}
