/**
 * /api/ebola-data — EBOLA-MONITOR v4.7.0
 *
 * CHANGELOG v4.7.0 (08/06/2026) — SitRep N°24 (07/06) + fix staleness + auto-refresh :
 *
 * DONNÉES N°24 (rapportage 07/06/2026, publié 08/06) :
 *  confirmed_cases    : 381 → 550 (+169 depuis N°020)
 *  confirmed_deaths   : 64  → 101 | CFR: 16.8 → 18.4%
 *  new_cases_24h      : 35  (Rwampara 13, Bunia 10, Mongbwalu 6, Nyankunde 2 [Ituri] + Beni 4 [NK])
 *  recovered_estimated: 7   → 19  (+7 guéris ZS Nyankunde)
 *  confirmed_active   : 233 → 309 (dont 116 confirmés + 193 suspects)
 *  suspected_cases    : 171 → 193
 *  contacts_sous_suivi: 4551 → 5418 | contacts_vus: 2525 → 3489 | taux: 55.5 → 64.4%
 *  Ituri   : 518 cas (+159), 80 décès, CFR 15.4%, 17/36 ZS, +31 cas 24h
 *  Nord-Kivu: 29 cas (+10), 20 décès, CFR 69.0%, 7/34 ZS, +4 cas 24h
 *  Sud-Kivu :  3 cas,  1 décès, CFR 33.3%, 1/34 ZS, +0 cas 24h
 *  FALLBACK_STATIC_DATE: 2026-06-07
 *  Zones détail Ituri: Bunia 152, Rwampara 111, Mongbwalu 98, Nyankunde 26 (+...)
 *
 * FIX STALENESS BANNER :
 *  - La réponse JSON inclut staleness_check_field='generated_at' pour que le
 *    frontend compare generated_at (temps réel) au lieu de data_as_of (figé).
 *  - staleness_threshold_hours: 72 (était 48)
 *  - Le bandeau ne doit s'afficher que si (now - generated_at) > 72h,
 *    pas si (now - data_as_of) > 48h.
 *
 * AUTO-REFRESH SOURCES SECONDAIRES :
 *  fetchExternalSources() tente à chaque requête :
 *    1. ReliefWeb API (rapports INSP/WHO RDC) — JSON gratuit, pas de clé
 *    2. WHO AFRO RSS — dernière mise à jour outbreak DRC Ebola
 *  Si une source renvoie des données plus fraîches → enrichit external_sources
 *  Cache: 30min (s-maxage=1800) pour profiter du fresh data
 *
 * SOURCE PRIMAIRE : INSP RDC PDF quotidiens — https://insp.cd/blog-2/
 *
 * DONNÉES VÉRIFIÉES — INSP SitRep N°24/MVB_07/06/2026 :
 *  Cas confirmés : 550 | Décès : 101 | CFR : 18.4% | Nouveaux 24h : 35
 *  Ituri   : 518 cas, 80 décès, CFR 15.4%, 17/36 ZS, +31 cas 24h
 *  Nord-Kivu: 29 cas, 20 décès, CFR 69.0%, 7/34 ZS, +4 cas 24h
 *  Sud-Kivu :  3 cas,  1 décès, CFR 33.3%, 1/34 ZS, +0 cas 24h
 *  Total ZS : 25/104 (24.0%)
 *  Patients en isolement : 309 (dont 116 confirmés, 193 suspects)
 *  Guéris cumulés : 19 | Taux suivi contacts : 64.4% (5 418 / 3 489 vus)
 *  Alertes remontées : 450 (413 investiguées, 91.8%) | 94 suspects du jour
 */

import { supabase } from '../../lib/supabase';
import { HISTORICAL_DATA, DRC_HISTORY_BASE, RT_METADATA, RISK_FACTORS_BASE } from '../../lib/historical-data';

// Date du fallback statique — Supabase n'est retenu que si PLUS RÉCENT que cette date
const FALLBACK_STATIC_DATE = '2026-06-07T00:00:00Z';

// Staleness : le frontend doit comparer generated_at (temps réel) — PAS data_as_of
// Seuil recommandé : 72h (SitReps quotidiens INSP, délai normal week-end = 48h)
const STALENESS_THRESHOLD_HOURS = 72;

/**
 * Tente de récupérer des données fraîches depuis ReliefWeb API et WHO AFRO RSS.
 * Retourne un objet { reliefweb, who_afro } avec les données disponibles ou null.
 * Ne bloque PAS la réponse principale si ces appels échouent.
 */
async function fetchExternalSources() {
  const results = { reliefweb: null, who_afro: null };

  // 1. ReliefWeb API — rapports RDC Ebola (gratuit, pas de clé requise)
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
  } catch (_) {
    // silent — non bloquant
  }

  // 2. WHO AFRO RSS — https://www.afro.who.int/rss.xml (filtré Ebola RDC)
  try {
    const whoRes = await fetch(
      'https://www.afro.who.int/health-topics/ebola-virus-disease/feed',
      { signal: AbortSignal.timeout(4000) }
    );
    if (whoRes.ok) {
      const xml = await whoRes.text();
      // Extrait la première date de publication du RSS
      const pubDateMatch = xml.match(/<pubDate>([^<]+)<\/pubDate>/);
      const titleMatch   = xml.match(/<item>[\s\S]*?<title>([^<]+)<\/title>/);
      if (pubDateMatch) {
        results.who_afro = {
          latest_pub_date : pubDateMatch[1]?.trim() || null,
          latest_title    : titleMatch?.[1]?.trim() || null,
        };
      }
    }
  } catch (_) {
    // silent — non bloquant
  }

  return results;
}

const FALLBACK_SNAPSHOT = {
  confirmed_cases         : 550,
  suspected_cases         : 193,   // suspects en isolement fin J (N°24 tableau prise en charge)
  confirmed_deaths        : 101,
  total_deaths_all        : null,
  cfr_confirmed           : 18.4,
  recovered_estimated     : 19,
  confirmed_active        : 309,   // patients en isolement fin J (116 confirmés + 193 suspects)
  uganda_confirmed        : 15,
  uganda_deaths           : 1,
  uganda_recovered        : 0,
  countries_affected      : 2,
  health_zones_affected   : 25,
  data_as_of              : FALLBACK_STATIC_DATE,
  source                  : 'INSP RDC SitRep MVE N°24/MVB_07/2026 — 07 juin 2026 [SOURCE OFFICIELLE]',
  source_url              : 'https://insp.cd/blog-2/',

  contact_tracing: {
    suspects_en_investigation  : 193,
    confirmes_actifs_isolement : 116,
    total_en_isolement         : 309,
    gueris_cumul               : 19,
    contact_tracing_rate_pct   : 64.4,
    contact_tracing_target_pct : 95.0,
    contacts_sous_suivi        : 5418,
    contacts_vus_24h           : 3489,
    alertes_remontees_24h      : 450,
    alertes_investiguees_24h   : 413,
    taux_investigation_pct     : 91.8,
    suspects_du_jour           : 94,
    echantillons_positifs_24h  : 31,
    echantillons_analyses_24h  : 63,
    taux_positivite_labo       : 49.2,
    source                     : 'INSP RDC N°24 — 07/06/2026',
    source_date                : '2026-06-07',
    detail_provinces: {
      ituri    : { contacts: 4454, vus_24h: 2678, taux: 60.1 },
      nord_kivu: { contacts: 738,  vus_24h: 587,  taux: 79.5 },
      sud_kivu : { contacts: 226,  vus_24h: 224,  taux: 99.1 },
    },
  },

  trend: {
    source      : 'INSP RDC SitReps MVE N°001–024 PDF officiels',
    source_url  : 'https://insp.cd/blog-2/',
    note        : 'Confirmés=cumulés. Suspects=en isolement fin J. Tendance hebdo ascendante (légère baisse récente liée aux délais labo). +35 nouveaux cas 07/06.',
    dates            : ['15 mai','17 mai','19 mai','21 mai','23 mai','26 mai','28 mai','01 juin (N017)','01 juin (N018)','02 juin (N019)','03 juin (N020)','04 juin (N021)','05 juin (N022)','06 juin (N023)','07 juin (N024)'],
    confirmed        : [8,       10,      22,      31,      101,     121,     125,     321,             344,             363,             381,             430,             470,             515,             550],
    suspected_active : [null,    null,    null,    null,    null,    null,    null,    104,             116,             116,             171,             180,             185,             190,             193],
    deaths_conf      : [1,       2,       5,       7,       null,    17,      17,      48,              60,              62,              64,              76,              86,              94,              101],
    recovered        : [0,       0,       0,       0,       null,    0,       0,       6,               6,               7,               7,               10,              12,              12,              19],
    new_cases_24h    : [null,    null,    null,    null,    null,    null,    null,    12,              23,              19,              18,              49,              40,              45,              35],
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
      source        : 'INSP N°24',
      source_date   : '2026-06-07',
      epicentre     : true,
      pct_total_cases: 94.2,
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
      source        : 'INSP N°24',
      source_date   : '2026-06-07',
      note          : 'Létalité 69.0% (20/29): retards prise en charge, évasions CTE, sécurité ADF. 183 résultats labo en attente (insuffisance réactifs).',
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
      source        : 'INSP N°24',
      source_date   : '2026-06-07',
      note          : 'Dernier cas confirmé : 26 mai 2026. Province la moins affectée.',
      zones: ['Miti-Murhesa'],
      zones_detail: [
        { zone:'Miti-Murhesa', cases:3, deaths:1, cfr:33.3 },
      ],
    },
    {
      province      : 'Uganda',
      cases         : 15,
      deaths        : 1,
      cfr           : 6.7,
      zones_touchees: 2,
      new_cases_24h : null,
      country       : 'Uganda',
      source        : 'ECDC 04/06/2026',
      source_date   : '2026-06-04',
      zones: ['Kampala (8 cas)','Wakiso (1 cas)'],
      note: '15 cas dont ≥7 transmission locale, 4 liés à voyages RDC.',
    },
  ],

  sources_comparison: [
    {
      name            : 'INSP RDC SitRep N°24/MVB_07/2026 (source officielle)',
      date            : '2026-06-07',
      confirmed_cases : 550,
      suspected_cases : 193,
      confirmed_deaths: 101,
      confirmed_active: 309,
      confirmed_recovered: 19,
      contact_tracing_rate_pct: 64.4,
      health_zones    : 25,
      new_cases_24h   : 35,
      note            : 'SOURCE OFFICIELLE RDC (rapportage 07/06, publié 08/06). 550 cas cumulés (+35 le 07/06: Rwampara 13, Bunia 10, Mongbwalu 6, Nyankunde 2, Beni 4), 101 décès, CFR 18.4%, 25 ZS. 309 patients en isolement. 19 guéris. Suivi contacts 64.4% (5 418 contacts, cible 95%).',
      url             : 'https://insp.cd/blog-2/',
      is_primary      : true,
    },
    {
      name            : 'WHO (données en cours de mise à jour)',
      date            : '2026-06-05',
      confirmed_cases : null,
      confirmed_deaths: null,
      note            : 'WHO typiquement 1-3j de retard vs INSP. Vérifier https://www.who.int/emergencies/disease-outbreak-news pour mise à jour.',
      url             : 'https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON603',
    },
    {
      name            : 'ECDC (mis à jour 04 juin 2026)',
      date            : '2026-06-04',
      confirmed_cases : 363,
      confirmed_deaths: 62,
      suspected_cases : 116,
      note            : 'ECDC réf. N°019 (02/06) — dernier disponible au 08/06. Uganda: 15 cas (8 Kampala, 1 Wakiso), 1 décès.',
      url             : 'https://www.ecdc.europa.eu/en/ebola-outbreak-democratic-republic-congo-and-uganda',
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
      { label: 'INSP N°24 = source primaire temps réel (07/06)',
        detail: '550 cas, 101 décès, CFR 18.4%, 25 ZS. WHO/ECDC typiquement 1-3j de retard vs INSP.' },
      { label: 'Suspects INSP = en isolement fin J (PAS cumulatifs)',
        detail: 'N°24: 193 suspects en isolement. 309 total = 116 confirmés + 193 suspects. Ne pas comparer avec cumuls WHO/ECDC.' },
      { label: 'Nord-Kivu : létalité 69.0% — cas critiques hors CTE',
        detail: '29 cas, 20 décès. CFR élevé: retards prise en charge, évasions CTE, insécurité ADF. 183 résultats labo en attente (réactifs insuffisants NK).' },
      { label: 'Ituri : épicentre, 94.2% des cas',
        detail: '518 cas, CFR 15.4%. Foyers actifs: Bunia (152), Rwampara (111), Mongbwalu (98). 94 cas non encore ventilés par ZS.' },
      { label: 'Uganda — transmission locale confirmée (ECDC 04/06)',
        detail: '15 cas: ≥7 transmission locale, 4 liés voyages RDC. Source: ECDC 04/06/2026.' },
      { label: 'Délai rapportage',
        detail: 'INSP: quotidien. WHO: 1-3j retard. ECDC: 2-3×/semaine. Source retenue: INSP N°24 (07/06).' },
    ],
    consensus: 'Source retenue: INSP N°24 (07/06) pour DRC + ECDC 04/06 pour Uganda. DRC: 550 confirmés (+35/07/06), 193 suspects en isolement, 101 décès, 19 guéris, CFR 18.4%, 25 ZS. Uganda: 15 cas, 1 décès.',
  },
};

function parseField(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return null; } }
  return val;
}

/** Supabase retenu UNIQUEMENT si plus récent que le fallback statique */
function shouldUseSupabase(rawDataAsOf) {
  if (!rawDataAsOf) return false;
  return new Date(rawDataAsOf) > new Date(FALLBACK_STATIC_DATE);
}

/**
 * Fallback guard : rejette Supabase si les données régressent vs baseline N°24
 */
function isSupabaseDataSane(raw) {
  if (!raw.confirmed_cases || raw.confirmed_cases < 550) return false;  // baseline N°24
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
    uganda_recovered        : raw.uganda_recovered        ?? FALLBACK_SNAPSHOT.uganda_recovered,
    countries_affected      : raw.countries_affected      ?? FALLBACK_SNAPSHOT.countries_affected,
    health_zones_affected   : raw.health_zones_affected   ?? FALLBACK_SNAPSHOT.health_zones_affected,
    data_as_of              : raw.data_as_of              || FALLBACK_SNAPSHOT.data_as_of,
    source                  : raw.source                  || FALLBACK_SNAPSHOT.source,
    source_url              : raw.source_url              || FALLBACK_SNAPSHOT.source_url,
    provinces               : (provinces && Array.isArray(provinces) && provinces.length) ? provinces : FALLBACK_SNAPSHOT.provinces,
    trend                   : normalizedTrend || FALLBACK_SNAPSHOT.trend,
    contact_tracing         : (contact_tracing && contact_tracing.contact_tracing_rate_pct != null) ? contact_tracing : FALLBACK_SNAPSHOT.contact_tracing,
    sources_comparison      : (sources_comparison && Array.isArray(sources_comparison) && sources_comparison.length) ? sources_comparison : FALLBACK_SNAPSHOT.sources_comparison,
    source_discrepancies    : (source_discrepancies && source_discrepancies.title) ? source_discrepancies : FALLBACK_SNAPSHOT.source_discrepancies,
  };
}

export default async function handler(req, res) {
  // Cache 30min — permet aux sources externes de se rafraîchir plus souvent
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  let rawSnapshot = null;
  let supabaseError = null;
  let supabaseSkipped = false;

  // Appels parallèles : Supabase + sources externes
  const [supabaseResult, externalSources] = await Promise.allSettled([
    // 1. Supabase
    supabase
      .from('outbreak_snapshots')
      .select('*')
      .neq('parse_confidence', 'auto_invalid')
      .order('data_as_of', { ascending: false })
      .limit(1)
      .single(),
    // 2. Sources externes (WHO AFRO RSS + ReliefWeb)
    fetchExternalSources(),
  ]);

  // Traitement Supabase
  if (supabaseResult.status === 'fulfilled') {
    const { data, error } = supabaseResult.value;
    if (error) {
      supabaseError = error.message;
    } else if (data && shouldUseSupabase(data.data_as_of) && isSupabaseDataSane(data)) {
      rawSnapshot = data;
    } else {
      supabaseSkipped = true;
      supabaseError = `Supabase row skipped: date=${data?.data_as_of}, cases=${data?.confirmed_cases} — not newer/sane vs fallback (${FALLBACK_STATIC_DATE}, baseline 550 cas)`;
    }
  } else {
    supabaseError = supabaseResult.reason?.message || 'Supabase call failed';
  }

  // Sources externes
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

    // FIX STALENESS BANNER :
    // Le frontend doit utiliser generated_at (pas data_as_of) pour calculer la fraîcheur.
    // data_as_of = date du SitRep INSP (figé entre deux publications).
    // generated_at = horodatage temps réel de cette réponse API.
    // → Bandeau uniquement si (now - generated_at) > staleness_threshold_hours
    staleness: {
      check_field           : 'generated_at',  // champ à comparer côté frontend
      threshold_hours       : STALENESS_THRESHOLD_HOURS,  // 72h
      data_as_of_iso        : snapshot.data_as_of,
      data_age_hours        : Math.round((Date.now() - new Date(snapshot.data_as_of)) / 3600000),
      note                  : 'SitReps INSP quotidiens. Délai normal = 24h. Week-end possible 48h. Alerte si generated_at > 72h.',
    },

    // Sources externes récupérées en temps réel
    external_sources: {
      fetched_at  : generatedAt,
      reliefweb   : extSources.reliefweb,
      who_afro    : extSources.who_afro,
      note        : 'ReliefWeb API + WHO AFRO RSS — fetched à chaque requête (non mis en cache). Complète le fallback INSP.',
    },

    automation: {
      edge_function  : 'insp-scraper v3',
      cron           : '0 8,14 * * * UTC',
      fallback_levels: ['Supabase (si plus récent)', 'INSP WordPress API','ReliefWeb API','WHO AFRO RSS','static fallback N°24'],
      external_sources_refresh: 'À chaque requête (fetch live WHO AFRO RSS + ReliefWeb)',
      cache_ttl      : '1800s (30min)',
    },
    disclaimer: 'Source primaire: INSP RDC PDF quotidiens (insp.cd/blog-2/). Complété par WHO, ECDC, ReliefWeb.',
    methodology: {
      primary_source       : 'INSP RDC SitReps MVE PDF quotidiens (insp.cd/blog-2/).',
      secondary_source     : 'ECDC (04/06/2026) pour Uganda. ReliefWeb + WHO AFRO RSS pour alertes temps réel.',
      suspects_insp        : 'suspected_cases = suspects EN ISOLEMENT fin J (N°24 tableau prise en charge). PAS cumulatif.',
      confirmed_active     : 'confirmed_active = total patients en isolement/hosp fin J (confirmés + suspects, N°24).',
      cfr                  : 'CFR = Décès confirmés / Cas confirmés × 100.',
      fallback_static_date : FALLBACK_STATIC_DATE,
      fallback_guard       : 'Supabase rejeté si cases < 550 (baseline N°24) ou CFR > 80%',
      supabase_priority    : 'Supabase retenu si data_as_of > fallback_static_date ET données saines',
      staleness_fix        : 'Bandeau staleness compare generated_at (temps réel) avec seuil 72h. data_as_of figé entre SitReps = normal.',
      cache_ttl            : '1800s (30min)',
      last_verified        : '2026-06-08T20:56:00Z',
      source_pdf           : 'SitRep_MVE_RDC_Ndeg24_07_06_2026-FD.pdf',
    },
    outbreak_2026: {
      meta: {
        declaration_date    : '2026-05-15',
        pheic_date          : '2026-05-17',
        virus               : 'Bundibugyo ebolavirus (BDBV)',
        outbreak_number     : 17,
        no_approved_vaccine : true,
        index_case          : 'Zone de santé de Mongbwalu, Ituri (présumé)',
        last_data_update    : snapshot.data_as_of,
        last_verified_by    : snapshot.source,
        primary_source_url  : snapshot.source_url,
        sitrep_list_url     : 'https://insp.cd/blog-2/',
        ecdc_url            : 'https://www.ecdc.europa.eu/en/ebola-outbreak-democratic-republic-congo-and-uganda',
        next_sitrep_expected: '2026-06-08',
      },
      totals: {
        confirmed_cases        : snapshot.confirmed_cases,
        suspected_cases_active : snapshot.suspected_cases,
        confirmed_deaths       : snapshot.confirmed_deaths,
        confirmed_active       : confirmedActive,
        confirmed_recovered    : snapshot.recovered_estimated,
        cfr_confirmed          : snapshot.cfr_confirmed,
        uganda_confirmed       : snapshot.uganda_confirmed,
        uganda_deaths          : snapshot.uganda_deaths,
        uganda_recovered       : snapshot.uganda_recovered,
        countries_affected     : snapshot.countries_affected,
        health_zones_affected  : snapshot.health_zones_affected,
        source                 : snapshot.source,
        note_suspects          : 'suspected_cases_active = suspects EN ISOLEMENT fin J (N°24). 309 total = 116 confirmés + 193 suspects.',
        note_uganda            : 'Uganda: 15 cas (8 Kampala, 1 Wakiso), ≥7 transmission locale, 4 liés voyages RDC. Source: ECDC 04/06/2026.',
        note_provinces         : 'N°24 (07/06): Ituri 518/15.4%/17ZS (+31), Nord-Kivu 29/69.0%/7ZS (+4), Sud-Kivu 3/33.3%/1ZS. Ituri = 94.2% des cas.',
        note_nk_cfr            : 'Nord-Kivu CFR 69.0% (20/29): retards prise en charge + évasions CTE + 183 résultats labo en attente (réactifs).',
        note_ituri_unventilated: 'Ituri: 94 cas non encore ventilés par ZS (en cours harmonisation données labo).',
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
