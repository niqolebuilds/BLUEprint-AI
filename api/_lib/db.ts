import { neon, NeonQueryFunction } from '@neondatabase/serverless';

let cached: NeonQueryFunction<false, false> | null = null;

/** Neon's HTTP-based driver — no connection pooling needed, safe for serverless. */
export function getSql(): NeonQueryFunction<false, false> {
  if (!cached) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not configured.');
    cached = neon(connectionString);
  }
  return cached;
}
