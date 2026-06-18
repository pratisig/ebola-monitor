/**
 * /api/ebola-data — EBOLA-MONITOR v5.4.0
 *
 * CHANGELOG v5.4.0 (18/06/2026) — SitRep N°33 INSP (16/06/2026) :
 *  confirmed_cases : 635 → 837 (+202)
 *  confirmed_deaths: 127 → 196 (+69)
 *  CFR             : 20.0% → 23.4%
 *  health_zones    : 26 → 31 (+5)
 *  Ituri : 600 → 763 cas, 18 → 20 ZS (nouvelles: Nia-Nia, Kambala)
 *  Nord-Kivu: 32 → 71 cas, 7 → 10 ZS (nouvelles: Mabalako, Masereka, Vuhovi)
 *  Sud-Kivu: 3 cas / 1 décès — inchangé
 *  Uganda : 19 cas / 2 décès — 0 nouveau cas depuis 05/06 (13 jours)
 *  Trend : points N°27–N°33 ajoutés
 *  isSupabaseDataSane baseline relevée à 837
 *  FALLBACK_STATIC_DATE mis à jour au 16/06
 *
 * CHANGELOG v5.1.0 (11/06/2026) — SitRep N°26 INSP (09/06/2026).
 * CHANGELOG v5.0.1 (10/06/2026) — fix spread snapshot racine (compat dashboard).
 * CHANGELOG v5.0.0 (10/06/2026) — ECDC 10/06 + SitRep N°25 INSP (08/06).
 */

import { supabase } from '../../lib/supabase';
import { HISTORICAL_DATA, DRC_HISTORY_BASE, RT_METADATA, RISK_FACTORS_BASE } from '../../lib/historical-data';

const FALLBACK_STATIC_DATE = '2026-06-16T23:59:00Z';
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
  confirmed_cases         : 837,
  suspected_cases         : null,
  confirmed_deaths        : 196,
  total_deaths_all        : null,
  cfr_confirmed           : 23.4,
  recovered_estimated     : null,
  confirmed_active        : null,
  // Uganda — 0 nouveau cas depuis 05/06 (13 jours consécutifs au 18/06)
  uganda_confirmed        : 19,
  uganda_deaths           : 2,
  uganda_probable         : 1,
  uganda_probable_deaths  : 1,
  uganda_recovered        : 5,
  uganda_imported         : 14,
  uganda_local_transmission: 5,
  uganda_last_case_date   : '2026-06-05',
  uganda_days_no_new_case : 13,
  hcw_cases               : 16,
  countries_affected      : 1,
  health_zones_affected   : 31,
  data_as_of              : FALLBACK_STATIC_DATE,
  source                  : 'INSP RDC SitRep MVE N°33/MVB_16/2026 — 16 juin 2026 [SOURCE OFFICIELLE]',
  source_url              : 'https://insp.cd/sitrep-n33-mvb_16-06-2026/',

  // Niveaux de risque WHO (réévaluation 6 juin 2026 — DON606)
  risk_levels: {
    drc                : 'très élevé',
    uganda             : 'élevé',
    border_countries   : 'élevé',
    africa_region      : 'faible',
    global             : 'faible',
    source             : 'WHO DON606 — 6 juin 2026',
    source_url         : 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON606',
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
    suspects_en_investigation  : null,
    confirmes_actifs_isolement : null,
    total_en_isolement         : null,
    gueris_cumul               : null,
    contacts_sous_suivi        : null,
    contacts_vus_24h           : null,
    contact_tracing_rate_pct   : null,
    contact_tracing_target_pct : 95.0,
    alertes_remontees_24h      : null,
    alertes_investiguees_24h   : null,
    taux_investigation_pct     : null,
    suspects_du_jour           : null,
    echantillons_positifs_24h  : null,
    echantillons_analyses_24h  : null,
    taux_positivite_labo       : null,
    source                     : 'INSP RDC N°33 (16 juin 2026) — données détaillées à confirmer',
    source_date                : '2026-06-16',
    detail_provinces: {
      ituri    : { contacts: null, vus_24h: null, taux: null },
      nord_kivu: { contacts: null, vus_24h: null, taux: null },
      sud_kivu : { contacts: null, vus_24h: null, taux: null },
    },
  },

  trend: {
    source      : 'INSP RDC SitReps MVE N°001–033 PDF officiels',
    source_url  : 'https://insp.cd/sitrep-n33-mvb_16-06-2026/',
    note        : 'Confirmés=cumulés. N°33 (16/06): 837 cas (+202 vs N°26), 196 décès, CFR 23.4%. 31 ZS (5 nouvelles: Nia-Nia, Kambala en Ituri; Mabalako, Masereka, Vuhovi en Nord-Kivu). Ituri~91.2% des cas.',
    dates            : ['15 mai','17 mai','19 mai','21 mai','23 mai','26 mai','28 mai','01 juin (N017)','01 juin (N018)','02 juin (N019)','03 juin (N020)','04 juin (N021)','05 juin (N022)','06 juin (N023)','07 juin (N024)','08 juin (N025)','09 juin (N026)','10 juin (N027)','11 juin (N028)','12 juin (N029)','13 juin (N030)','14 juin (N031)','15 juin (N032)','16 juin (N033)'],
    confirmed        : [8,       10,      22,      31,      101,     121,     125,     321,             344,             363,             381,             430,             470,             515,             550,             598,             635,             676,             710,             710,             782,             808,             null,            837],
    suspected_active : [null,    null,    null,    null,    null,    null,    null,    104,             116,             116,             171,             180,             185,             190,             193,             193,             143,             null,            null,            null,            null,            null,            null,            null],
    deaths_conf      : [1,       2,       5,       7,       null,    17,      17,      48,              60,              62,              64,              76,              86,              94,              101,             115,             127,             136,             149,             149,             166,             192,             null,            196],
    recovered        : [0,       0,       0,       0,       null,    0,       0,       6,               6,               7,               7,               10,              12,              12,              19,              22,              30,              null,            null,            null,            null,            null,            null,            null],
    new_cases_24h    : [null,    null,    null,    null,    null,    null,    null,    12,              23,              19,              18,              49,              40,              45,              35,              48,              37,              null,            21,              null,            72,              null,            null,            29],
  },

  provinces: [
    {
      province      : 'Ituri',
      cases         : 763,
      deaths        : 179,
      cfr           : 23.5,
      zones_touchees: 20,
      new_cases_24h : 29,
      country       : 'DRC',
      source        : 'INSP N°33 (16/06/2026) + mediacongo 16/06',
      source_date   : '2026-06-16',
      epicentre     : true,
      pct_total_cases: 91.2,
      zones: [
        'Aru','Aungba','Bambu','Bunia','Damas','Gety','Kilo','Kambala',
        'Komanda','Lita','Logo','Mambasa','Mangala','Mongbwalu',
        'Nia-Nia','Nizi','Nyankunde','Rimba','Rwampara','Tchomia'
      ],
      zones_detail: [
        { zone:'Bunia',     cases:null, deaths:null, cfr:null },
        { zone:'Rwampara',  cases:null, deaths:null, cfr:null },
        { zone:'Mongbwalu', cases:null, deaths:null, cfr:null },
        { zone:'Nyankunde', cases:null, deaths:null, cfr:null },
        { zone:'Nizi',      cases:null, deaths:null, cfr:null },
        { zone:'Lita',      cases:null, deaths:null, cfr:null },
        { zone:'Komanda',   cases:null, deaths:null, cfr:null },
        { zone:'Bambu',     cases:null, deaths:null, cfr:null },
        { zone:'Kilo',      cases:null, deaths:null, cfr:null },
        { zone:'Rimba',     cases:null, deaths:null, cfr:null },
        { zone:'Aru',       cases:null, deaths:null, cfr:null },
        { zone:'Damas',     cases:null, deaths:null, cfr:null },
        { zone:'Logo',      cases:null, deaths:null, cfr:null },
        { zone:'Mambasa',   cases:null, deaths:null, cfr:null },
        { zone:'Tchomia',   cases:null, deaths:null, cfr:null },
        { zone:'Aungba',    cases:null, deaths:null, cfr:null },
        { zone:'Mangala',   cases:null, deaths:null, cfr:null },
        { zone:'Gety',      cases:null, deaths:null, cfr:null },
        { zone:'Nia-Nia',   cases:null, deaths:null, cfr:null },
        { zone:'Kambala',   cases:null, deaths:null, cfr:null },
      ],
      note: 'N°33 (16/06): ~763 cas (20 ZS, ~91.2% du total). Nouvelles ZS: Nia-Nia et Kambala. Foyers actifs au 16/06: Mongbwalu(+10), Rwampara(+7), Nizi(+5), Nyankunde(+3), Lita(+3), Komanda(+1). Ventilation détaillée par ZS à confirmer sur PDF officiel N°33.',
    },
    {
      province      : 'Nord-Kivu',
      cases         : 71,
      deaths        : 16,
      cfr           : 22.5,
      zones_touchees: 10,
      new_cases_24h : null,
      country       : 'DRC',
      source        : 'INSP N°33 (16/06/2026) + WHO AFRO 14/06 + caritasdev 15/06',
      source_date   : '2026-06-16',
      note          : 'N°33: 71 cas, 10/34 ZS. 3 nouvelles ZS vs N°26: Mabalako, Masereka, Vuhovi. CFR 22.5% (amélioration vs 68.8% au N°26 grâce à une meilleure prise en charge).',
      zones: [
        'Beni','Butembo','Goma','Kalunguta','Katwa',
        'Kyondo','Mabalako','Masereka','Oicha','Vuhovi'
      ],
      zones_detail: [
        { zone:'Katwa',    cases:null, deaths:null, cfr:null },
        { zone:'Beni',     cases:null, deaths:null, cfr:null },
        { zone:'Butembo',  cases:null, deaths:null, cfr:null },
        { zone:'Oicha',    cases:null, deaths:null, cfr:null },
        { zone:'Kalunguta',cases:null, deaths:null, cfr:null },
        { zone:'Kyondo',   cases:null, deaths:null, cfr:null },
        { zone:'Goma',     cases:null, deaths:null, cfr:null },
        { zone:'Mabalako', cases:null, deaths:null, cfr:null },
        { zone:'Masereka', cases:null, deaths:null, cfr:null },
        { zone:'Vuhovi',   cases:null, deaths:null, cfr:null },
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
      source        : 'INSP N°33 (inchangé)',
      source_date   : '2026-06-16',
      note          : 'Dernier cas confirmé : 26 mai 2026. Inchangé depuis N°20. Province la moins affectée.',
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
      source        : 'WHO DON606 + ECDC (14/06)',
      source_date   : '2026-06-14',
      zones: ['Kampala (8 cas)', 'Wakiso (1 cas)'],
      last_case_date: '2026-06-05',
      consecutive_days_no_new_case: 13,
      note: '19 cas: 14 importés RDC (~70% Congolais cherchant soins), 5 transmission locale. 2 décès (cas importés). 5 guéris. DERNIER CAS : 05 juin 2026. 13 jours consécutifs sans nouveau cas au 18/06. Pas de transmission communautaire documentée.',
    },
  ],

  sources_comparison: [
    {
      name            : 'INSP RDC SitRep N°33/MVB_16/2026 (source primaire officielle)',
      date            : '2026-06-16',
      confirmed_cases : 837,
      suspected_cases : null,
      confirmed_deaths: 196,
      confirmed_active: null,
      confirmed_recovered: null,
      contact_tracing_rate_pct: null,
      health_zones    : 31,
      new_cases_24h   : 29,
      note            : 'SOURCE OFFICIELLE RDC (16/06). 837 cas cumulés (+202 vs N°26), 196 décès, CFR 23.4%. 5 nouvelles ZS: Nia-Nia et Kambala (Ituri), Mabalako, Masereka et Vuhovi (Nord-Kivu). Total 31/104 ZS touchées.',
      url             : 'https://insp.cd/sitrep-n33-mvb_16-06-2026/',
      is_primary      : true,
    },
    {
      name            : 'mediacongo.net (15 juin 2026)',
      date            : '2026-06-15',
      confirmed_cases : 837,
      confirmed_deaths: 196,
      note            : '837 cas confirmés, 196 décès. Ituri concentre plus de 91% des infections. Source secondaire concordante avec N°33.',
      url             : 'https://www.mediacongo.net/article-actualite-164760_virus_ebola_837_cas_confirmes_et_196_deces_l_ituri_concentre_plus_de_91_des_infections.html',
    },
    {
      name            : 'caritasdev.cd (15 juin 2026) — SitRep N°30',
      date            : '2026-06-15',
      confirmed_cases : 782,
      confirmed_deaths: 166,
      health_zones    : null,
      new_cases_24h   : 72,
      note            : 'N°30 (13/06): 72 nouveaux cas (+29 Ituri, +43 Nord-Kivu). Données antérieures au N°33.',
      url             : 'https://caritasdev.cd/rdc-72-nouveaux-cas-debola-confirmes-en-ituri-et-nord-kivu-au-cours-de-la-journee-du-13-juin-2026/',
    },
    {
      name            : 'WHO AFRO (14 juin 2026)',
      date            : '2026-06-14',
      confirmed_cases : 808,
      confirmed_deaths: 192,
      note            : 'N°31 (14/06): 808 cas, 192 décès. Données antérieures au N°33.',
      url             : 'https://www.afro.who.int/health-topics/disease-outbreaks/ebola-who-african-region',
    },
    {
      name            : 'INSP RDC SitRep N°26/MVB_09/2026',
      date            : '2026-06-09',
      confirmed_cases : 635,
      suspected_cases : 119,
      confirmed_deaths: 127,
      confirmed_active: 260,
      confirmed_recovered: 30,
      contact_tracing_rate_pct: 61.1,
      health_zones    : 26,
      new_cases_24h   : 37,
      note            : 'N°26 (09/06): 635 cas (+37), 127 décès, CFR 20.0%, 260 en isolement, 30 guéris. Nouvelle ZS: Tchomia (Ituri).',
      url             : 'https://insp.cd/blog-2/',
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
      { label: 'INSP N°33 (16/06) = source primaire officielle RDC la plus récente',
        detail: '837 cas, 196 décès, CFR 23.4%, 31 ZS. Ituri: ~763 cas (91.2%), 20 ZS (Nia-Nia et Kambala nouvelles). Nord-Kivu: ~71 cas, 10 ZS (Mabalako, Masereka, Vuhovi nouvelles). +202 cas en 7 jours vs N°26.' },
      { label: 'CFR en hausse : 20.0% (N°26) → 23.4% (N°33)',
        detail: 'Augmentation de 3.4 points en 7 jours. Lié à la propagation vers Nord-Kivu (insécurité ADF, retards PEC, évasions CTE) et à des foyers isolés à létalité élevée (Mongbwalu: CFR historique ~37%).' },
      { label: '5 nouvelles zones de santé touchées vs N°26',
        detail: 'Nia-Nia et Kambala en Ituri (20 ZS); Mabalako, Masereka et Vuhovi en Nord-Kivu (10 ZS). Total: 31/104 ZS surveillées.' },
      { label: 'Ituri: ~91.2% des cas malgré l\'expansion géographique',
        detail: '~763/837 cas. Épicentre stable Mongbwalu–Rwampara–Bunia. Foyers actifs au 16/06: Mongbwalu(+10), Rwampara(+7), Nizi(+5), Nyankunde(+3), Lita(+3), Komanda(+1).' },
      { label: 'Uganda — signal positif : 13 jours sans nouveau cas',
        detail: '19 cas: 14 importés RDC, 5 transmission locale. 2 décès. 5 guéris. Dernier cas: 05/06/2026. Si 42 jours sans nouveau cas confirmés → fin d\'épidémie Uganda.' },
    ],
    consensus: 'INSP N°33 (16/06): DRC 837 cas, 196 décès, CFR 23.4%, 31 ZS. Ituri ~763 (20 ZS, 91.2%), Nord-Kivu ~71 (10 ZS), Sud-Kivu 3. Uganda: 19 cas, 2 décès, 0 nouveau depuis 13 jours.',
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
  // Baseline N°33: 837 cas — rejeter toute donnée Supabase inférieure ou invalide
  if (!raw.confirmed_cases || raw.confirmed_cases < 837) return false;
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
      supabaseError = `Supabase row skipped: date=${data?.data_as_of}, cases=${data?.confirmed_cases} — not newer/sane vs fallback (${FALLBACK_STATIC_DATE}, baseline 837 cas)`;
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
    primary_source: 'INSP RDC — https://insp.cd/sitrep-n33-mvb_16-06-2026/',
    supabase_error: supabaseError || null,

    staleness: {
      check_field           : 'generated_at',
      threshold_hours       : STALENESS_THRESHOLD_HOURS,
      data_as_of_iso        : snapshot.data_as_of,
      data_age_hours        : Math.round((Date.now() - new Date(snapshot.data_as_of)) / 3600000),
      note                  : 'data_as_of = date de la dernière source officielle (INSP N°33 16/06). Seuil alerte: 72h.',
    },

    // === CLÉ IMBRIQUÉE (compat nouveaux clients) ===
    snapshot: snapshotWithActive,

    risk_factors     : RISK_FACTORS_BASE,
    rt_metadata      : RT_METADATA,
    drc_history      : drcHistory,
    all_outbreaks    : allData,
    external_sources : extSources,

    meta: {
      version       : '5.4.0',
      sitrep        : 'N°33/MVB_16/06/2026',
      sources_used  : ['INSP RDC N°33 (16/06/2026)', 'mediacongo 16/06/2026', 'WHO AFRO 14/06/2026', 'caritasdev 15/06/2026'],
      note          : 'N°33 (16/06): 837 cas (+202 vs N°26), 196 décès, CFR 23.4%, 31 ZS. Ituri ~763 cas (20 ZS), Nord-Kivu ~71 (10 ZS), Sud-Kivu 3. Uganda: 0 nouveau cas depuis 13 jours. Ventilation détaillée par ZS à compléter depuis PDF N°33.',
    },
  });
}
