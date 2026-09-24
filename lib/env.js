// Settings. Secrets come from Vercel environment variables, never from the site files.
import { createHash } from 'node:crypto';

const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || '';

export const env = {
  HELIUS_API_KEY: process.env.HELIUS_API_KEY || '',
  DATABASE_URL: dbUrl,
  // Helius signs its webhook calls with this. Derived from the database secret unless set.
  HELIUS_WEBHOOK_SECRET: process.env.HELIUS_WEBHOOK_SECRET ||
    (dbUrl ? 'echoes_' + createHash('sha256').update('echoes-webhook:' + dbUrl).digest('hex').slice(0, 40) : ''),
  // where Helius should send webhooks: PUBLIC_URL if set, else the project's production domain on Vercel
  PUBLIC_URL: (process.env.PUBLIC_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : '')).replace(/\/$/, ''),
  MAX_ECHOES: Number(process.env.MAX_ECHOES || 1000),
};

export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const LAMPORTS = 1_000_000_000;
export const START_SOL = 1;          // every echo starts with 1 paper SOL
export const MIN_TRADE_SOL = 0.005;

const LABEL = { DATABASE_URL: 'database', HELIUS_API_KEY: 'HELIUS_API_KEY', HELIUS_WEBHOOK_SECRET: 'database' };

export function requireEnv(...names) {
  const missing = [...new Set(names.filter((n) => !env[n]).map((n) => LABEL[n] || n))];
  if (missing.length) {
    const err = new Error('Setup not finished: missing ' + missing.join(', '));
    err.status = 503;
    err.expose = true;
    err.setup = missing;
    throw err;
  }
}
