/**
 * /api/cron-insp — Cron Vercel quotidien 08h00 UTC
 * Appelle l'Edge Function insp-scraper sur Supabase
 * Configurer dans vercel.json : { "crons": [{ "path": "/api/cron-insp", "schedule": "0 8 * * *" }] }
 */
export const config = { runtime: 'edge' };

export default async function handler(req) {
  // Sécurité : vérifier le header Vercel Cron
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/insp-scraper`, {
      method: 'POST',
      headers: {
        'Content-Type'  : 'application/json',
        'Authorization' : `Bearer ${SERVICE_ROLE_KEY}`,
      },
      signal: AbortSignal.timeout(30000),
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
