/**
 * /api/cron-insp — Cron Vercel quotidien 08h00 + 14h00 UTC
 * Appelle l'Edge Function insp-scraper sur Supabase
 * vercel.json : { "crons": [{ "path": "/api/cron-insp", "schedule": "0 8 * * *" }, { "path": "/api/cron-insp", "schedule": "0 14 * * *" }] }
 *
 * FIX : Vercel injecte automatiquement CRON_SECRET dans Authorization
 * si la variable d'env s'appelle exactement CRON_SECRET.
 * Sur Vercel Pro/Enterprise le header est envoyé automatiquement.
 * Sur Hobby, le cron est appelé sans auth — on accepte les deux.
 */
export const config = { runtime: 'edge' };

export default async function handler(req) {
  // Sécurité : accepter soit CRON_SECRET soit appel interne Vercel (pas de header)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Si CRON_SECRET défini, vérifier — sinon laisser passer (Vercel Hobby)
  if (cronSecret && authHeader && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({
      error: 'Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/insp-scraper`, {
      method: 'POST',
      headers: {
        'Content-Type'  : 'application/json',
        'Authorization' : `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ triggered_by: 'vercel-cron', triggered_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(55000),
    });

    const data = await res.json();
    console.log('[cron-insp]', JSON.stringify(data));

    return new Response(JSON.stringify({
      triggered_at : new Date().toISOString(),
      edge_status  : res.status,
      result       : data,
    }), {
      status: res.ok ? 200 : 502,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[cron-insp] Error:', err.message);
    return new Response(JSON.stringify({ error: err.message, triggered_at: new Date().toISOString() }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
