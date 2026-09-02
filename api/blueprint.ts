import { routeAction } from './_lib/actions.js';

// Vercel injects a Node IncomingMessage/ServerResponse pair augmented with
// .body/.query and .status()/.json() helpers; typed loosely to avoid pulling
// in @vercel/node purely for its type declarations.
export default async function handler(req: { method?: string; body?: unknown }, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const data = await routeAction(body?.action, body?.token, body?.payload);
    res.status(200).json({ ok: true, data });
  } catch (err) {
    res.status(200).json({ ok: false, error: err instanceof Error ? err.message : 'Request failed.' });
  }
}
