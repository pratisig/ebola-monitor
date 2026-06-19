/**
 * Données historiques Ebola 1976–2026
 * Source: WHO Ebola Historical Database
 * https://www.who.int/news-room/fact-sheets/detail/ebola-virus-disease
 * Source complémentaire: CDC Outbreak History
 * https://www.cdc.gov/ebola/history/outbreaks.html
 * Dernière vérification: 17 juin 2026
 *
 * NOTE: Ces données historiques sont stables et ne changent pas.
 * Elles sont stockées ici en JavaScript (pas en base) pour performance.
 * Seules les données de l'épidémie EN COURS sont dynamiques (Supabase).
 */

export const HISTORICAL_SOURCE = {
  name: 'WHO Ebola Historical Database + CDC',
  url: 'https://www.who.int/news-room/fact-sheets/detail/ebola-virus-disease',
  cdc_url: 'https://www.cdc.gov/ebola/history/outbreaks.html',
  last_verified: '2026-06-17',
};

export const HISTORICAL_DATA = [
  { year:1976, country:'DRC',           cases:318,   deaths:280,  cfr:88,   species:'Zaire',      status:'Over' },
  { year:1976, country:'Sudan',         cases:284,   deaths:151,  cfr:53,   species:'Sudan',      status:'Over' },
  { year:1977, country:'DRC',           cases:1,     deaths:1,    cfr:100,  species:'Zaire',      status:'Over' },
  { year:1979, country:'Sudan',         cases:34,    deaths:22,   cfr:65,   species:'Sudan',      status:'Over' },
  { year:1994, country:'Gabon',         cases:52,    deaths:31,   cfr:60,   species:'Zaire',      status:'Over' },
  { year:1994, country:"C\u00f4te d'Ivoire", cases:1, deaths:0,   cfr:0,    species:"Ta\u00ef Forest", status:'Over' },
  { year:1995, country:'DRC',           cases:315,   deaths:254,  cfr:81,   species:'Zaire',      status:'Over' },
  { year:1996, country:'Gabon',         cases:31,    deaths:21,   cfr:68,   species:'Zaire',      status:'Over' },
  { year:1996, country:'Gabon',         cases:60,    deaths:45,   cfr:75,   species:'Zaire',      status:'Over' },
  { year:1996, country:'South Africa',  cases:2,     deaths:1,    cfr:50,   species:'Zaire',      status:'Over' },
  { year:2000, country:'Uganda',        cases:425,   deaths:224,  cfr:53,   species:'Sudan',      status:'Over' },
  { year:2001, country:'Gabon',         cases:65,    deaths:53,   cfr:82,   species:'Zaire',      status:'Over' },
  { year:2001, country:'Rep. Congo',    cases:57,    deaths:43,   cfr:75,   species:'Zaire',      status:'Over' },
  { year:2002, country:'Rep. Congo',    cases:143,   deaths:128,  cfr:90,   species:'Zaire',      status:'Over' },
  { year:2004, country:'Sudan',         cases:17,    deaths:7,    cfr:41,   species:'Sudan',      status:'Over' },
  { year:2005, country:'Rep. Congo',    cases:12,    deaths:10,   cfr:83,   species:'Zaire',      status:'Over' },
  { year:2007, country:'DRC',           cases:264,   deaths:187,  cfr:71,   species:'Zaire',      status:'Over' },
  { year:2007, country:'Uganda',        cases:149,   deaths:37,   cfr:25,   species:'Bundibugyo', status:'Over' },
  { year:2008, country:'DRC',           cases:32,    deaths:14,   cfr:44,   species:'Zaire',      status:'Over' },
  { year:2011, country:'Uganda',        cases:1,     deaths:1,    cfr:100,  species:'Sudan',      status:'Over' },
  { year:2012, country:'DRC',           cases:77,    deaths:36,   cfr:47,   species:'Bundibugyo', status:'Over' },
  { year:2012, country:'Uganda',        cases:24,    deaths:17,   cfr:71,   species:'Sudan',      status:'Over' },
  { year:2014, country:'Guinea',        cases:3811,  deaths:2543, cfr:67,   species:'Zaire',      status:'Over' },
  { year:2014, country:'Sierra Leone',  cases:14124, deaths:3956, cfr:28,   species:'Zaire',      status:'Over' },
  { year:2014, country:'Liberia',       cases:10675, deaths:4809, cfr:45,   species:'Zaire',      status:'Over' },
  { year:2014, country:'Nigeria',       cases:20,    deaths:8,    cfr:40,   species:'Zaire',      status:'Over' },
  { year:2014, country:'Senegal',       cases:1,     deaths:0,    cfr:0,    species:'Zaire',      status:'Over' },
  { year:2014, country:'Mali',          cases:8,     deaths:6,    cfr:75,   species:'Zaire',      status:'Over' },
  { year:2014, country:'USA',           cases:4,     deaths:1,    cfr:25,   species:'Zaire',      status:'Over' },
  { year:2017, country:'DRC',           cases:8,     deaths:4,    cfr:50,   species:'Zaire',      status:'Over' },
  { year:2018, country:'DRC',           cases:54,    deaths:33,   cfr:61,   species:'Zaire',      status:'Over' },
  { year:2018, country:'DRC',           cases:3481,  deaths:2299, cfr:66,   species:'Zaire',      status:'Over' }, // Kivu
  { year:2020, country:'DRC',           cases:130,   deaths:55,   cfr:42,   species:'Zaire',      status:'Over' },
  { year:2021, country:'Guinea',        cases:23,    deaths:12,   cfr:52,   species:'Zaire',      status:'Over' },
  { year:2021, country:'DRC',           cases:12,    deaths:6,    cfr:50,   species:'Zaire',      status:'Over' },
  { year:2022, country:'DRC',           cases:6,     deaths:6,    cfr:100,  species:'Zaire',      status:'Over' },
  { year:2022, country:'Uganda',        cases:164,   deaths:55,   cfr:34,   species:'Sudan',      status:'Over' },
  { year:2025, country:'Uganda',        cases:14,    deaths:4,    cfr:29,   species:'Sudan',      status:'Over' },
  { year:2025, country:'DRC',           cases:64,    deaths:45,   cfr:70,   species:'Zaire',      status:'Over' },
  // Épidémie en cours 2026 — Bundibugyo — déclarée le 15 mai 2026
  { year:2026, country:'DRC',           cases:896,   deaths:232,  cfr:25.9, species:'Bundibugyo', status:'Active' }, // SitRep OMS 17 juin 2026
  { year:2026, country:'Uganda',        cases:19,    deaths:2,    cfr:10.5, species:'Bundibugyo', status:'Active' }, // SitRep OMS 17 juin 2026
];

export const DRC_HISTORY_BASE = [
  { label:'1976',          cases:318,   deaths:280,  cfr:88  },
  { label:'1995',          cases:315,   deaths:254,  cfr:81  },
  { label:'2007',          cases:264,   deaths:187,  cfr:71  },
  { label:'2008',          cases:32,    deaths:14,   cfr:44  },
  { label:'2018 (Kivu)',   cases:3481,  deaths:2299, cfr:66  },
  { label:'2020',          cases:130,   deaths:55,   cfr:42  },
  { label:'2021',          cases:12,    deaths:6,    cfr:50  },
  { label:'2022',          cases:6,     deaths:6,    cfr:100 },
  { label:'2025',          cases:64,    deaths:45,   cfr:70  },
  { label:'2026 (en cours)', cases:896, deaths:232,  cfr:25.9 }, // SitRep OMS 17/06/2026
];

export const RT_METADATA = {
  value: 2.1,
  ci_low: 1.8,
  ci_high: 2.5,
  date: '2026-06-17',
  source: 'WHO / ECDC',
  source_url: 'https://www.ecdc.europa.eu/en/ebola-outbreak-democratic-republic-congo-and-uganda',
  method: 'EpiEstim (Cori et al. 2013)',
  serial_interval_days: 7,
  note: 'IC 95%: [1.8 – 2.5]. Valeur > 1 = croissance active. Accélération confirmée par l\'OMS le 19 juin 2026. Mis à jour à chaque sitrep WHO.',
};

export const RISK_FACTORS_BASE = [
  { label:'Propagation transfronti\u00e8re', level:92, color:'#e63946', basis:'Uganda: 19 cas confirm\u00e9s, 2 d\u00e9c\u00e8s (OMS 17 juin 2026)' },
  { label:'Exposition agents de sant\u00e9',  level:80, color:'#e63946', basis:'Transmission nosocomiale confirm\u00e9e, 33 zones de sant\u00e9 touch\u00e9es' },
  { label:'Transmission communautaire',  level:85, color:'#e63946', basis:'Acc\u00e9l\u00e9ration confirm\u00e9e par l\'OMS — 72 cas/j record le 15 juin' },
  { label:'Acc\u00e8s cha\u00eene logistique',    level:65, color:'#f4a261', basis:'Conflit arm\u00e9 actif Nord-Kivu/Sud-Kivu, expansion g\u00e9ographique' },
  { label:'Disponibilit\u00e9 vaccin BDBV',  level:95, color:'#e63946', basis:'Aucun vaccin/traitement approuv\u00e9 pour BDBV — essais en cours' },
  { label:'Couverture surveillance',     level:55, color:'#f4a261', basis:'516 lits disponibles, >2000 tests/jour — riposte en renforcement' },
];
