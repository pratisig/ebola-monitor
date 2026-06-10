/**
 * /api/ebola-data — EBOLA-MONITOR v4.9.0
 *
 * CHANGELOG v4.9.0 (10/06/2026) — Sources WHO DON606 + ECDC 9/06 + CDC 7/06 :
 *
 * CORRECTIONS SOURCES MULTI :
 *  Uganda : 15 → 19 cas, 1 → 2 décès (WHO DON606 + CDC + ECDC concordent)
 *           +1 cas probable / +1 décès probable
 *           14 cas importés, 5 transmission locale confirmée
 *           Kampala (8 cas), Wakiso (1 cas)
 *  HCW    : 16 cas parmi personnels de santé (WHO DON606)
 *  Contacts : 5040 identifiés, 2535 vus 24h (WHO DON606 — 6 juin)
 *             Ituri 43.2%, Nord-Kivu 82.5%, Sud-Kivu 80.3%
 *  sources_comparison :
 *   - WHO DON606 mis à jour (6 juin) : 515 DRC, 91 décès, 534 total
 *   - ECDC mis à jour (9 juin)       : 550 DRC, 101 décès
 *   - CDC mis à jour (7 juin)        : 550 DRC, 101 décès
 *  Plan continental WHO/AfricaCDC : 518 M USD
 *  Niveaux de risque WHO confirmés : DRC=très élevé, Uganda=élevé
 *
 * DONNÉES N°25 INSP inchangées (source primaire la plus récente) :
 *  confirmed_cases : 598 | confirmed_deaths : 115 | CFR : 19.2%
 *  new_cases_24h   : 48 (RECORD) | recovered : 22 | en isolement : 297
 *
 * SOURCE OFFICIELLE PRIMAIRE : INSP RDC — https://insp.cd/blog-2/
 */

import { supabase } from '../../lib/supabase';
import { HISTORICAL_DATA, DRC_HISTORY_BASE, RT_METADATA, RISK_FACTORS_BASE } from '../../lib/historical-data';

const FALLBACK_STATIC_DATE = '2026-06-08T00:00:00Z';
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
  confirmed_cases         : 598,
  suspected_cases         : 193,
  confirmed_deaths        : 115,
  total_deaths_all        : null,
  cfr_confirmed           : 19.2,
  recovered_estimated     : 22,
  confirmed_active        : 297,
  // Uganda — WHO DON606 + CDC + ECDC (concordance 3 sources, 06-09/06)
  uganda_confirmed        : 19,
  uganda_deaths           : 2,
  uganda_probable         : 1,
  uganda_probable_deaths  : 1,
  uganda_recovered        : 5,
  uganda_imported         : 14,
  uganda_local_transmission: 5,
  uganda_districts        : ['Kampala (8 cas)', 'Wakiso (1 cas)'],
  hcw_cases               : 16,
  countries_affected      : 2,
  health_zones_affected   : 25,
  data_as_of              : FALLBACK_STATIC_DATE,
  source                  : 'INSP RDC SitRep MVE N°25/MVB_08/2026 — 08 juin 2026 [SOURCE OFFICIELLE]',
  source_url              : 'https://insp.cd/blog-2/',

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
    suspects_en_investigation  : 193,
    confirmes_actifs_isolement : 116,
    total_en_isolement         : 297,
    gueris_cumul               : 22,
    // Données WHO DON606 (6 juin) — plus complètes que N°25 pour provinces
    contacts_sous_suivi        : 5040,
    contacts_vus_24h           : 2535,
    contact_tracing_rate_pct   : 50.3,   // 2535/5040
    contact_tracing_target_pct : 95.0,
    alertes_remontees_24h      : 450,
    alertes_investiguees_24h   : 413,
    taux_investigation_pct     : 91.8,
    suspects_du_jour           : 94,
    echantillons_positifs_24h  : 48,
    echantillons_analyses_24h  : null,
    taux_positivite_labo       : null,
    source                     : 'WHO DON606 (6 juin) + INSP RDC N°25 (8 juin)',
    source_date                : '2026-06-08',
    detail_provinces: {
      ituri    : { contacts: 4118, vus_24h: 1780, taux: 43.2 },
      nord_kivu: { contacts: 699,  vus_24h: 577,  taux: 82.5 },
      sud_kivu : { contacts: 223,  vus_24h: 178,  taux: 80.3 },
    },
  },

  trend: {
    source      : 'INSP RDC SitReps MVE N°001–025 PDF officiels',
    source_url  : 'https://insp.cd/blog-2/',
    note        : 'Confirmés=cumulés. Suspects=en isolement fin J. N°25 (08/06): 48 nouveaux cas — RECORD JOURNALIER absolu depuis J1.',
    dates            : ['15 mai','17 mai','19 mai','21 mai','23 mai','26 mai','28 mai','01 juin (N017)','01 juin (N018)','02 juin (N019)','03 juin (N020)','04 juin (N021)','05 juin (N022)','06 juin (N023)','07 juin (N024)','08 juin (N025)'],
    confirmed        : [8,       10,      22,      31,      101,     121,     125,     321,             344,             363,             381,             430,             470,             515,             550,             598],
    suspected_active : [null,    null,    null,    null,    null,    null,    null,    104,             116,             116,             171,             180,             185,             190,             193,             193],
    deaths_conf      : [1,       2,       5,       7,       null,    17,      17,      48,              60,              62,              64,              76,              86,              94,              101,             115],
    recovered        : [0,       0,       0,       0,       null,    0,       0,       6,               6,               7,               7,               10,              12,              12,              19,              22],
    new_cases_24h    : [null,    null,    null,    null,    null,    null,    null,    12,              23,              19,              18,              49,              40,              45,              35,              48],
  },

  provinces: [
    {
      province      : 'Ituri',
      cases         : 518,
      deaths        : 80,
      cfr           : 15.4,
      zones_touchees: 17,
      new_cases_24h : 31,
      country       : 'DRC',
      source        : 'INSP N°24 + WHO DON606 (6 juin)',
      source_date   : '2026-06-07',
      epicentre     : true,
      pct_total_cases: 86.6,
      zones: ['Aru','Aungba','Bambu','Bunia','Damas','Gety','Kilo','Komanda','Lita','Logo','Mambasa','Mangala','Mongbwalu','Nizi','Nyankunde','Rimba','Rwampara'],
      zones_detail: [
        { zone:'Bunia',     cases:152, deaths:15, cfr:9.9  },
        { zone:'Rwampara',  cases:111, deaths:20, cfr:18.0 },
        { zone:'Mongbwalu', cases:98,  deaths:29, cfr:29.6 },
        { zone:'Nyankunde', cases:26,  deaths:1,  cfr:3.8  },
        { zone:'Bambu',     cases:5,   deaths:2,  cfr:40.0 },
        { zone:'Nizi',      cases:5,   deaths:0,  cfr:0.0  },
        { zone:'Kilo',      cases:4,   deaths:1,  cfr:25.0 },
        { zone:'Lita',      cases:4,   deaths:0,  cfr:0.0  },
        { zone:'Rimba',     cases:3,   deaths:0,  cfr:0.0  },
        { zone:'Aru',       cases:3,   deaths:1,  cfr:33.3 },
        { zone:'Damas',     cases:3,   deaths:0,  cfr:0.0  },
        { zone:'Komanda',   cases:3,   deaths:0,  cfr:0.0  },
        { zone:'Logo',      cases:2,   deaths:0,  cfr:0.0  },
        { zone:'Mambasa',   cases:2,   deaths:1,  cfr:50.0 },
        { zone:'Mangala',   cases:1,   deaths:0,  cfr:0.0  },
        { zone:'Aungba',    cases:1,   deaths:0,  cfr:0.0  },
        { zone:'Gety',      cases:1,   deaths:0,  cfr:0.0  },
        { zone:'Autres ZS (données non ventilées)', cases:94, deaths:10, cfr:10.6 },
      ],
    },
    {
      province      : 'Nord-Kivu',
      cases         : 29,
      deaths        : 20,
      cfr           : 69.0,
      zones_touchees: 7,
      new_cases_24h : 4,
      country       : 'DRC',
      source        : 'INSP N°24 + WHO DON606',
      source_date   : '2026-06-07',
      note          : 'Létalité 69.0% (20/29): retards prise en charge, évasions CTE, sécurité ADF. WHO DON606 confirme CFR 64% en Nord-Kivu.',
      zones: ['Beni','Butembo','Goma','Kalunguta','Katwa','Kyondo','Oicha'],
      zones_detail: [
        { zone:'Katwa',     cases:11, deaths:8,  cfr:72.7 },
        { zone:'Beni',      cases:9,  deaths:7,  cfr:77.8 },
        { zone:'Butembo',   cases:4,  deaths:2,  cfr:50.0 },
        { zone:'Oicha',     cases:2,  deaths:2,  cfr:100  },
        { zone:'Kalunguta', cases:1,  deaths:1,  cfr:100  },
        { zone:'Kyondo',    cases:1,  deaths:0,  cfr:0.0  },
        { zone:'Goma',      cases:1,  deaths:0,  cfr:0.0  },
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
      source        : 'INSP N°24 + WHO DON606',
      source_date   : '2026-06-07',
      note          : 'Dernier cas confirmé : 26 mai 2026. Province la moins affectée.',
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
      new_cases_24h : null,
      country       : 'Uganda',
      source        : 'WHO DON606 + CDC + ECDC (concordance 3 sources)',
      source_date   : '2026-06-08',
      zones: ['Kampala (8 cas)','Wakiso (1 cas)'],
      note: '19 cas: 14 importés RDC (~70% Congolais cherchant soins), 5 transmission locale. 2 décès (cas importés). 5 guéris. Pas de transmission communautaire documentée. Cas UAE: risque faible confirmé par WHO (pas de cas secondaire).',
    },
  ],

  sources_comparison: [
    {
      name            : 'INSP RDC SitRep N°25/MVB_08/2026 (source primaire)',
      date            : '2026-06-08',
      confirmed_cases : 598,
      suspected_cases : 193,
      confirmed_deaths: 115,
      confirmed_active: 297,
      confirmed_recovered: 22,
      contact_tracing_rate_pct: 64.4,
      health_zones    : 25,
      new_cases_24h   : 48,
      note            : 'SOURCE OFFICIELLE RDC (08/06). 598 cas cumulés (+48 le 08/06 — RECORD JOURNALIER), 115 décès, CFR 19.2%, 297 en isolement, 22 guéris.',
      url             : 'https://insp.cd/blog-2/',
      is_primary      : true,
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
      note            : 'DRC: 515 cas, 91 décès, CFR 17.7%, 25 ZS (Ituri 94%). Uganda: 19 cas, 2 décès, 5 guéris. Total combiné: 534 cas, 93 décès (CFR 17.4%). Plan continental 518M USD lancé 5/06.',
      url             : 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON606',
    },
    {
      name            : 'ECDC (9 juin 2026 — données MoH 8 juin)',
      date            : '2026-06-09',
      confirmed_cases : 550,
      confirmed_deaths: 101,
      confirmed_active: 309,
      uganda_confirmed: 19,
      uganda_deaths   : 2,
      note            : 'DRC: 550 cas, 101 décès, 309 hospitalisés en isolement. +35 nouveaux cas, +10 décès vs 8/06. Ituri: 518 cas (17 ZS). Nord-Kivu: 29 cas (7 ZS). Uganda: 19 cas, 2 décès, 5 transmission locale, 14 importés.',
      url             : 'https://www.ecdc.europa.eu/en/ebola-outbreak-democratic-republic-congo-and-uganda',
    },
    {
      name            : 'CDC (7 juin 2026)',
      date            : '2026-06-07',
      confirmed_cases : 550,
      confirmed_deaths: 101,
      uganda_confirmed: 19,
      uganda_deaths   : 2,
      note            : 'DRC: 550 cas, 101 décès. Uganda: 19 cas, 2 décès, 1 probable/1 décès probable. Américain transféré en Allemagne (stable). Screening aérien renforcé IAD/ATL/IAH/JFK.',
      url             : 'https://www.cdc.gov/ebola/situation-summary/index.html',
    },
    {
      name            : 'ReliefWeb (aggrégateur)',
      date            : null,
      confirmed_cases : null,
      note            : 'Aggrégateur — voir external_sources dans la réponse pour la dernière entrée ReliefWeb.',
      url             : 'https://reliefweb.int/disaster/ep-2026-000060-cod',
    },
  ],

  source_discrepancies: {
    title: 'Pourquoi les chiffres diffèrent entre sources ?',
    reasons: [
      { label: 'INSP N°25 (08/06) = source la plus récente',
        detail: '598 cas, 115 décès, CFR 19.2%, 48 nouveaux (RECORD). Publiée 8 juin = plus récente que WHO DON606 (6/06) ou ECDC (données 8/06 MoH sans +48).' },
      { label: 'WHO DON606 (6 juin) : 515 DRC + 19 Uganda = 534 total',
        detail: '515 DRC, 91 décès; 19 Uganda, 2 décès; 534 total combiné, 93 décès, CFR 17.4%. WHO confirme: risque DRC=très élevé, Uganda=élevé.' },
      { label: 'ECDC/CDC (8-9 juin) : 550 DRC, 101 décès',
        detail: 'Correspondent aux chiffres MoH RDC du 8 juin AVANT la publication N°25 INSP (+48 cas). Écart 550→598 = backlog de tests + 48 nouvelles infections 08/06.' },
      { label: 'Record journalier N°25 : 48 cas en 24h',
        detail: 'Pic absolu depuis J1. En partie dû à la montée en puissance des capacités diagnostiques et au rattrapage de backlog d\'échantillons.' },
      { label: 'Nord-Kivu : létalité 69% — cas critiques hors CTE',
        detail: '29 cas, 20 décès. WHO DON606 confirme CFR 64% en Nord-Kivu. Retards prise en charge, évasions CTE, insécurité ADF.' },
      { label: 'Uganda — 19 cas confirmés (concordance WHO/CDC/ECDC)',
        detail: '14 importés (~70% Congolais cherchant soins), 5 transmission locale. 2 décès chez cas importés. Cas UAE: risque faible confirmé (pas de cas secondaire). Pas de transmission communautaire documentée.' },
      { label: 'Suspects INSP = en isolement fin J (PAS cumulatifs)',
        detail: '297 total en isolement au N°25. Ne pas comparer avec cumuls WHO/ECDC.' },
    ],
    consensus: 'Source primaire: INSP N°25 (08/06). DRC: 598 cas (+48/08/06 RECORD), 115 décès, CFR 19.2%, 22 guéris, 297 en isolement. Uganda: 19 cas, 2 décès (WHO/CDC/ECDC concordent). Total combiné: ≥617 cas, ≥117 décès.',
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
  if (!raw.confirmed_cases || raw.confirmed_cases < 598) return false;
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
      supabaseError = `Supabase row skipped: date=${data?.data_as_of}, cases=${data?.confirmed_cases} — not newer/sane vs fallback (${FALLBACK_STATIC_DATE}, baseline 598 cas)`;
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

  res.status(200).json({
    success       : true,
    generated_at  : generatedAt,
    data_as_of    : snapshot.data_as_of,
    data_source   : rawSnapshot
      ? 'Supabase'
      : (supabaseSkipped ? 'FALLBACK_STATIC (Supabase not newer/sane)' : 'FALLBACK_STATIC (Supabase error)'),
    primary_source: 'INSP RDC — https://insp.cd/blog-2/',
    supabase_error: supabaseError || null,

    staleness: {
      check_field           : 'generated_at',
      threshold_hours       : STALENESS_THRESHOLD_HOURS,
      data_as_of_iso        : snapshot.data_as_of,
      data_age_hours        : Math.round((Date.now() - new Date(snapshot.data_as_of)) / 3600000),
      note                  : 'data_as_of = date du dernier SitRep INSP (figé). Comparer generated_at pour la fraîcheur réelle.',
    },

    snapshot: {
      ...snapshot,
      confirmed_active: confirmedActive,
    },

    risk_factors     : RISK_FACTORS_BASE,
    rt_metadata      : RT_METADATA,
    drc_history      : drcHistory,
    all_outbreaks    : allData,
    external_sources : extSources,

    meta: {
      version       : '4.9.0',
      sitrep        : 'N°25/MVB_08/06/2026',
      sources_used  : ['INSP N°25 (08/06)', 'WHO DON606 (06/06)', 'ECDC (09/06)', 'CDC (07/06)'],
      note          : 'N°25 (08/06): 598 cas (+48 RECORD), 115 décès, CFR 19.2%. Uganda: 19 cas, 2 décès (concordance WHO/CDC/ECDC). Plan continental 518M USD.',
    },
  });
}
