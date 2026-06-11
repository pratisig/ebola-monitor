/**
 * /api/ebola-data — EBOLA-MONITOR v5.1.0
 *
 * CHANGELOG v5.1.0 (11/06/2026) — SitRep N°26 INSP (09/06/2026) :
 *  confirmed_cases : 598 → 635 (+37)
 *  confirmed_deaths: 115 → 127 (+12)
 *  CFR             : 19.2% → 20.0%
 *  recovered_cumul : 22 → 30 (+8 guéris: 7 Nyankunde + 1 Mongbwalu)
 *  health_zones    : 25 → 26 (nouvelle ZS: Tchomia, Ituri)
 *  new_cases_24h   : 37 (tous en Ituri)
 *  en_isolement    : 297 → 260 (117 confirmés + 143 suspects)
 *  contacts_sous_suivi : 5040 → 6022 ; taux suivi: 50.3% → 61.1%
 *  Ituri: 563 → 600 cas, 80 → 104 décès, 17 → 18 ZS
 *  Nord-Kivu: 32 cas / 22 décès (CFR 68.8%) — inchangé
 *  Sud-Kivu: 3 cas / 1 décès — inchangé
 *
 * FIX PAGE NOIRE: isSupabaseDataSane baseline relevée à 635,
 *   shouldUseSupabase compare vs FALLBACK_STATIC_DATE mis à jour (09/06),
 *   FALLBACK_SNAPSHOT entièrement mis à jour N°26.
 *
 * CHANGELOG v5.0.1 (10/06/2026) — fix spread snapshot racine (compat dashboard).
 * CHANGELOG v5.0.0 (10/06/2026) — ECDC 10/06 + SitRep N°25 INSP (08/06).
 */

import { supabase } from '../../lib/supabase';
import { HISTORICAL_DATA, DRC_HISTORY_BASE, RT_METADATA, RISK_FACTORS_BASE } from '../../lib/historical-data';

const FALLBACK_STATIC_DATE = '2026-06-09T23:59:00Z';
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
  confirmed_cases         : 635,
  suspected_cases         : 119,
  confirmed_deaths        : 127,
  total_deaths_all        : null,
  cfr_confirmed           : 20.0,
  recovered_estimated     : 30,
  confirmed_active        : 260,
  // Uganda — données inchangées vs N°25 (dernière mise à jour ECDC 10/06)
  uganda_confirmed        : 19,
  uganda_deaths           : 2,
  uganda_probable         : 1,
  uganda_probable_deaths  : 1,
  uganda_recovered        : 5,
  uganda_imported         : 14,
  uganda_local_transmission: 5,
  uganda_last_case_date   : '2026-06-05',
  uganda_days_no_new_case : 6,
  hcw_cases               : 16,
  countries_affected      : 1,
  health_zones_affected   : 26,
  data_as_of              : FALLBACK_STATIC_DATE,
  source                  : 'INSP RDC SitRep MVE N°26/MVB_09/2026 — 09 juin 2026 [SOURCE OFFICIELLE]',
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
    suspects_en_investigation  : 119,
    confirmes_actifs_isolement : 117,
    total_en_isolement         : 260,
    gueris_cumul               : 30,
    contacts_sous_suivi        : 6022,
    contacts_vus_24h           : 3679,
    contact_tracing_rate_pct   : 61.1,
    contact_tracing_target_pct : 95.0,
    alertes_remontees_24h      : 616,
    alertes_investiguees_24h   : 574,
    taux_investigation_pct     : 93.2,
    suspects_du_jour           : 119,
    echantillons_positifs_24h  : 37,
    echantillons_analyses_24h  : 54,
    taux_positivite_labo       : 68.5,
    source                     : 'INSP RDC N°26 (9 juin 2026)',
    source_date                : '2026-06-09',
    detail_provinces: {
      ituri    : { contacts: 4955, vus_24h: 2860, taux: 57.7 },
      nord_kivu: { contacts: 841,  vus_24h: 597,  taux: 71.0 },
      sud_kivu : { contacts: 226,  vus_24h: 222,  taux: 98.2 },
    },
  },

  trend: {
    source      : 'INSP RDC SitReps MVE N°001–026 PDF officiels',
    source_url  : 'https://insp.cd/blog-2/',
    note        : 'Confirmés=cumulés. Suspects=en isolement fin J. N°26 (09/06): 37 nouveaux cas. Nouvelle ZS Tchomia (Ituri). 8 guéris supplémentaires.',
    dates            : ['15 mai','17 mai','19 mai','21 mai','23 mai','26 mai','28 mai','01 juin (N017)','01 juin (N018)','02 juin (N019)','03 juin (N020)','04 juin (N021)','05 juin (N022)','06 juin (N023)','07 juin (N024)','08 juin (N025)','09 juin (N026)'],
    confirmed        : [8,       10,      22,      31,      101,     121,     125,     321,             344,             363,             381,             430,             470,             515,             550,             598,             635],
    suspected_active : [null,    null,    null,    null,    null,    null,    null,    104,             116,             116,             171,             180,             185,             190,             193,             193,             143],
    deaths_conf      : [1,       2,       5,       7,       null,    17,      17,      48,              60,              62,              64,              76,              86,              94,              101,             115,             127],
    recovered        : [0,       0,       0,       0,       null,    0,       0,       6,               6,               7,               7,               10,              12,              12,              19,              22,              30],
    new_cases_24h    : [null,    null,    null,    null,    null,    null,    null,    12,              23,              19,              18,              49,              40,              45,              35,              48,              37],
  },

  provinces: [
    {
      province      : 'Ituri',
      cases         : 600,
      deaths        : 104,
      cfr           : 17.3,
      zones_touchees: 18,
      new_cases_24h : 37,
      country       : 'DRC',
      source        : 'INSP N°26 (09/06/2026)',
      source_date   : '2026-06-09',
      epicentre     : true,
      pct_total_cases: 94.5,
      zones: ['Aru','Aungba','Bambu','Bunia','Damas','Gety','Kilo','Komanda','Lita','Logo','Mambasa','Mangala','Mongbwalu','Nizi','Nyankunde','Rimba','Rwampara','Tchomia'],
      zones_detail: [
        { zone:'Bunia',     cases:173, deaths:15, cfr:8.7  },
        { zone:'Rwampara',  cases:133, deaths:25, cfr:18.8 },
        { zone:'Mongbwalu', cases:127, deaths:47, cfr:37.0 },
        { zone:'Nyankunde', cases:32,  deaths:1,  cfr:3.1  },
        { zone:'Nizi',      cases:5,   deaths:0,  cfr:0.0  },
        { zone:'Bambu',     cases:5,   deaths:2,  cfr:40.0 },
        { zone:'Lita',      cases:5,   deaths:0,  cfr:0.0  },
        { zone:'Kilo',      cases:4,   deaths:1,  cfr:25.0 },
        { zone:'Rimba',     cases:3,   deaths:0,  cfr:0.0  },
        { zone:'Aru',       cases:3,   deaths:1,  cfr:33.3 },
        { zone:'Damas',     cases:3,   deaths:0,  cfr:0.0  },
        { zone:'Komanda',   cases:3,   deaths:0,  cfr:0.0  },
        { zone:'Logo',      cases:2,   deaths:0,  cfr:0.0  },
        { zone:'Mambasa',   cases:2,   deaths:1,  cfr:50.0 },
        { zone:'Tchomia',   cases:2,   deaths:0,  cfr:0.0  },
        { zone:'Aungba',    cases:2,   deaths:1,  cfr:50.0 },
        { zone:'Mangala',   cases:1,   deaths:0,  cfr:0.0  },
        { zone:'Gety',      cases:1,   deaths:0,  cfr:0.0  },
        { zone:'Autres ZS (données non ventilées)', cases:94, deaths:10, cfr:10.6 },
      ],
      note: 'N°26 (09/06): 600 cas (18 ZS). Nouvelle ZS: Tchomia. 37 nouveaux cas: Mongbwalu(13), Rwampara(11), Bunia(10), Tchomia(2), Lita(1). 7 guéris à Nyankunde + 1 à Mongbwalu.',
    },
    {
      province      : 'Nord-Kivu',
      cases         : 32,
      deaths        : 22,
      cfr           : 68.8,
      zones_touchees: 7,
      new_cases_24h : 0,
      country       : 'DRC',
      source        : 'INSP N°26 (09/06/2026)',
      source_date   : '2026-06-09',
      note          : 'Létalité 68.8% (22/32): retards prise en charge, évasions CTE, insécurité ADF. Aucun nouveau cas le 09/06.',
      zones: ['Beni','Butembo','Goma','Kalunguta','Katwa','Kyondo','Oicha'],
      zones_detail: [
        { zone:'Katwa',     cases:12, deaths:8,  cfr:66.7 },
        { zone:'Beni',      cases:9,  deaths:7,  cfr:77.8 },
        { zone:'Butembo',   cases:6,  deaths:4,  cfr:66.7 },
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
      source        : 'INSP N°26 (inchangé)',
      source_date   : '2026-06-09',
      note          : 'Dernier cas confirmé : 26 mai 2026. Province la moins affectée. Inchangé depuis N°20.',
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
      source        : 'WHO DON606 + CDC + ECDC 10/06 (concordance 3 sources)',
      source_date   : '2026-06-10',
      zones: ['Kampala (8 cas)', 'Wakiso (1 cas)'],
      note: '19 cas: 14 importés RDC (~70% Congolais cherchant soins), 5 transmission locale. 2 décès (cas importés). 5 guéris. DERNIER CAS : 05 juin 2026. Aucun nouveau cas depuis (6 jours consécutifs). Pas de transmission communautaire documentée.',
      last_case_date: '2026-06-05',
      consecutive_days_no_new_case: 6,
    },
  ],

  sources_comparison: [
    {
      name            : 'INSP RDC SitRep N°26/MVB_09/2026 (source primaire officielle)',
      date            : '2026-06-09',
      confirmed_cases : 635,
      suspected_cases : 119,
      confirmed_deaths: 127,
      confirmed_active: 260,
      confirmed_recovered: 30,
      contact_tracing_rate_pct: 61.1,
      health_zones    : 26,
      new_cases_24h   : 37,
      note            : 'SOURCE OFFICIELLE RDC (09/06). 635 cas cumulés (+37), 127 décès, CFR 20.0%, 260 en isolement, 30 guéris. Nouvelle ZS: Tchomia (Ituri). 26/104 ZS touchées.',
      url             : 'https://insp.cd/blog-2/',
      is_primary      : true,
    },
    {
      name            : 'ECDC (10 juin 2026 — mise à jour 13h20)',
      date            : '2026-06-10',
      confirmed_cases : 598,
      ituri_cases     : 563,
      nord_kivu_cases : 32,
      uganda_confirmed: 19,
      uganda_deaths   : 2,
      note            : 'Données ECDC arrêtées au 10/06 matin (avant N°26). DRC: Ituri 563 cas (17 ZS) + Nord-Kivu 32 + Sud-Kivu 3 = 598. Uganda: dernier cas 05/06.',
      url             : 'https://www.ecdc.europa.eu/en/ebola-outbreak-democratic-republic-congo-and-uganda',
    },
    {
      name            : 'INSP RDC SitRep N°25/MVB_08/2026',
      date            : '2026-06-08',
      confirmed_cases : 598,
      suspected_cases : 193,
      confirmed_deaths: 115,
      confirmed_active: 297,
      confirmed_recovered: 22,
      contact_tracing_rate_pct: 64.4,
      health_zones    : 25,
      new_cases_24h   : 48,
      note            : 'N°25 (08/06): 598 cas (+48 RECORD JOURNALIER), 115 décès, CFR 19.2%, 297 en isolement, 22 guéris.',
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
      url             : 'https://www.who.int/emergencies/disease-outlook-news/item/2026-DON606',
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
      { label: 'INSP N°26 (09/06) = source primaire officielle RDC la plus récente',
        detail: '635 cas, 127 décès, CFR 20.0%, 37 nouveaux cas le 09/06. 26 ZS (nouvelle: Tchomia, Ituri). 30 guéris cumulés. 260 en isolement. Contacts: 6022 sous suivi, taux 61.1%.' },
      { label: 'ECDC 10/06 = 598 cas (données arrêtées avant N°26)',
        detail: 'Ituri 563 (17 ZS) + Nord-Kivu 32 (7 ZS) + Sud-Kivu 3 = 598 DRC. Décalage de 1 jour vs INSP N°26 (635 cas, 18 ZS Ituri).' },
      { label: 'WHO DON606 (6 juin) : 515 DRC + 19 Uganda = 534 total',
        detail: '515 DRC, 91 décès; 19 Uganda, 2 décès; 534 total combiné, 93 décès (CFR 17.4%). Plan continental 518M USD.' },
      { label: 'Nouvelle ZS Tchomia (Ituri) — 26ème ZS nationale touchée',
        detail: 'Première notification le 09/06. 2 cas confirmés, 0 décès à ce stade.' },
      { label: 'Ituri: CFR faible (17.3%) malgré le plus grand nombre de cas',
        detail: 'Capacité de prise en charge améliorée (HGR Bunia + HGR Rwampara opérationnels). Contraste avec Nord-Kivu: CFR 68.8% (insécurité ADF, retards PEC, évasions CTE).' },
      { label: 'Suivi des contacts: taux global 61.1% (cible 95%)',
        detail: 'Ituri: 57.7% (4955 contacts); Nord-Kivu: 71.0% (841); Sud-Kivu: 98.2% (226). 439 nouveaux contacts listés le 09/06.' },
      { label: 'Uganda — signal positif: 0 nouveau cas depuis 05/06 (6 jours)',
        detail: '14 importés RDC, 5 transmission locale. 2 décès. 5 guéris. Pas de transmission communautaire documentée.' },
    ],
    consensus: 'INSP N°26 (09/06): DRC 635 cas, 127 décès, CFR 20.0%. Ituri 600 (18 ZS, 94.5%), Nord-Kivu 32 (68.8% CFR), Sud-Kivu 3. Uganda: 19 cas, 2 décès, 0 nouveau depuis 6 jours.',
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
  // Baseline N°26: 635 cas — rejeter toute donnée Supabase inférieure ou invalide
  if (!raw.confirmed_cases || raw.confirmed_cases < 635) return false;
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
      supabaseError = `Supabase row skipped: date=${data?.data_as_of}, cases=${data?.confirmed_cases} — not newer/sane vs fallback (${FALLBACK_STATIC_DATE}, baseline 635 cas)`;
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
    primary_source: 'INSP RDC — https://insp.cd/blog-2/',
    supabase_error: supabaseError || null,

    staleness: {
      check_field           : 'generated_at',
      threshold_hours       : STALENESS_THRESHOLD_HOURS,
      data_as_of_iso        : snapshot.data_as_of,
      data_age_hours        : Math.round((Date.now() - new Date(snapshot.data_as_of)) / 3600000),
      note                  : 'data_as_of = date de la dernière source officielle (INSP N°26 09/06). Seuil alerte: 72h.',
    },

    // === CLÉ IMBRIQUÉE (compat nouveaux clients) ===
    snapshot: snapshotWithActive,

    risk_factors     : RISK_FACTORS_BASE,
    rt_metadata      : RT_METADATA,
    drc_history      : drcHistory,
    all_outbreaks    : allData,
    external_sources : extSources,

    meta: {
      version       : '5.1.0',
      sitrep        : 'N°26/MVB_09/06/2026',
      sources_used  : ['INSP RDC N°26 (09/06/2026)', 'ECDC 10/06/2026', 'WHO DON606 (06/06)', 'CDC (07/06)'],
      note          : 'N°26 (09/06): 635 cas (+37), 127 décès, CFR 20.0%, 30 guéris. Nouvelle ZS Tchomia (Ituri, 18ème). 26/104 ZS touchées. Contacts: 6022 (taux 61.1%). Uganda: 0 nouveau cas depuis 6 jours.',
      fix            : 'v5.1.0 — FALLBACK_SNAPSHOT N°26 + baseline isSupabaseDataSane relevée à 635 + FALLBACK_STATIC_DATE mis à jour 09/06. Fix page noire: données toujours disponibles.',
    },
  });
}
