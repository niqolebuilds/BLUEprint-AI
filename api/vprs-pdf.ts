import { generateVprsPdfPack, GenerateVprsPdfPackInput } from './_lib/vprsPdf.js';

// Vercel injects a Node IncomingMessage/ServerResponse pair augmented with
// .body/.query and .status()/.json() helpers; typed loosely to avoid pulling
// in @vercel/node purely for its type declarations (same convention as
// api/blueprint.ts).
export default async function handler(req: { method?: string; body?: unknown }, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }
  try {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as GenerateVprsPdfPackInput;
    if (!body?.proc || !body?.plan) {
      res.status(400).json({ ok: false, error: 'Missing proc or plan in request body.' });
      return;
    }
    const result = await generateVprsPdfPack(body);
    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    console.error('vprs-pdf: generation failed', err);
    res.status(200).json({ ok: false, error: err instanceof Error ? err.message : 'VPRS pack generation failed.' });
  }
}
