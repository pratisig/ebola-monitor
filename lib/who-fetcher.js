/**
 * who-fetcher.js — Récupère les données officielles depuis WHO/ECDC
 *
 * Stratégie de mise à jour:
 * 1. Parse la page WHO Ebola DRC 2026 (HTML public) pour extraire les chiffres
 * 2. En cas d'échec, retourne les dernières données connues depuis Supabase
 * 3. Le cron tourne toutes les 4h (configuré dans vercel.json)
 *
 * IMPORTANT: WHO ne fournit pas d'API officielle REST pour les sitreps.
 * Cette approche parse le HTML public du site WHO, ce qui est légal et standard
 * pour un outil de santé publique institutionnel.
 *
 * Sources:
 * - WHO: https://www.who.int/emergencies/situations/ebola-outbreak---drc-2026
 * - ECDC: https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda
 */

const WHO_URL = 'https://www.who.int/emergencies/situations/ebola-outbreak---drc-2026';
const ECDC_URL = 'https://www.ecdc.europa.eu/en/ebola-virus-disease-outbreak-democratic-republic-congo-and-uganda';

/**
 * Extrait les chiffres clés depuis la page WHO.
 * Retourne null si le parsing échoue (le cron garde alors les anciennes données).
 */
export async function fetchWHOData() {
  try {
    const res = await fetch(WHO_URL, {
      headers: { 'User-Agent': 'EbolaMonitor/4.0 (Public Health Dashboard; contact: dashboard@health-monitor.org)' },
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`WHO fetch failed: ${res.status}`);
    const html = await res.text();

    // Extraction des nombres dans le texte WHO
    // Pattern: "X confirmed cases" ou "X confirmed"
    const confirmedMatch = html.match(/(\d[\d,]*)\s+confirmed\s+cases?/i);
    const suspectedMatch = html.match(/(\d[\d,]*)\s+suspected\s+cases?/i);
    const deathsMatch    = html.match(/(\d[\d,]*)\s+deaths?/i);
    const lastUpdMatch   = html.match(/last\s+updated?[:\s]+([\w\s,]+202\d)/i);

    const confirmed = confirmedMatch ? parseInt(confirmedMatch[1].replace(/,/g,'')) : null;
    const suspected = suspectedMatch ? parseInt(suspectedMatch[1].replace(/,/g,'')) : null;
    const deaths    = deathsMatch    ? parseInt(deathsMatch[1].replace(/,/g,''))    : null;
    const lastUpdate = lastUpdMatch  ? lastUpdMatch[1].trim() : new Date().toISOString().slice(0,10);

    if (!confirmed && !suspected) {
      console.warn('[who-fetcher] Parsing WHO page: no numbers found, HTML structure may have changed');
      return null;
    }

    return {
      source: 'WHO',
      source_url: WHO_URL,
      fetched_at: new Date().toISOString(),
      last_update_text: lastUpdate,
      confirmed_cases: confirmed,
      suspected_cases: suspected,
      confirmed_deaths: deaths,
      cfr_confirmed: (confirmed && deaths) ? parseFloat(((deaths/confirmed)*100).toFixed(1)) : null,
      parse_confidence: 'auto', // 'auto' = parsed, 'manual' = saisie manuelle vérifiée
    };
  } catch (err) {
    console.error('[who-fetcher] Error fetching WHO:', err.message);
    return null;
  }
}

/**
 * Extrait les chiffres depuis la page ECDC (fallback si WHO indisponible)
 */
export async function fetchECDCData() {
  try {
    const res = await fetch(ECDC_URL, {
      headers: { 'User-Agent': 'EbolaMonitor/4.0 (Public Health Dashboard)' },
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`ECDC fetch failed: ${res.status}`);
    const html = await res.text();

    const confirmedMatch = html.match(/(\d[\d,]*)\s+confirmed\s+cases?/i);
    const suspectedMatch = html.match(/(\d[\d,]*)\s+suspected\s+cases?/i);
    const deathsMatch    = html.match(/(\d[\d,]*)\s+deaths?/i);

    const confirmed = confirmedMatch ? parseInt(confirmedMatch[1].replace(/,/g,'')) : null;
    const suspected = suspectedMatch ? parseInt(suspectedMatch[1].replace(/,/g,'')) : null;
    const deaths    = deathsMatch    ? parseInt(deathsMatch[1].replace(/,/g,''))    : null;

    if (!confirmed) return null;

    return {
      source: 'ECDC',
      source_url: ECDC_URL,
      fetched_at: new Date().toISOString(),
      confirmed_cases: confirmed,
      suspected_cases: suspected,
      confirmed_deaths: deaths,
      cfr_confirmed: (confirmed && deaths) ? parseFloat(((deaths/confirmed)*100).toFixed(1)) : null,
      parse_confidence: 'auto',
    };
  } catch (err) {
    console.error('[who-fetcher] Error fetching ECDC:', err.message);
    return null;
  }
}
