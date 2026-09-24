// Postgres (Neon or Supabase, connected through Vercel Storage). Server-side only.
import pg from 'pg';
import { env, requireEnv } from './env.js';
import { SCHEMA } from './schema.js';

pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v))); // numeric -> number
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));   // bigint  -> number

let pool = null;
let ready = null;

function makePool() {
  requireEnv('DATABASE_URL');
  const u = new URL(env.DATABASE_URL);
  const local = ['localhost', '127.0.0.1', '::1'].includes(u.hostname);
  for (const k of ['sslmode', 'supa', 'pgbouncer', 'sslrootcert', 'channel_binding']) u.searchParams.delete(k);
  return new pg.Pool({
    connectionString: u.toString(),
    ssl: local ? false : { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

async function init() {
  pool ||= makePool();
  ready ||= (async () => {
    const c = await pool.connect();
    try {
      await c.query(`begin; select pg_advisory_xact_lock(771100); ${SCHEMA}; commit;`);
    } catch (e) {
      await c.query('rollback').catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  })().catch((e) => {
    ready = null;
    throw e;
  });
  await ready;
}

// q`select ...` style is avoided on purpose: always parameterized text + values.
export async function q(text, values = []) {
  await init();
  const r = await pool.query(text, values);
  return r.rows;
}

export async function one(text, values = []) {
  return (await q(text, values))[0] || null;
}

// Run fn inside a transaction. fn gets its own q(text, values).
export async function tx(fn) {
  await init();
  const c = await pool.connect();
  try {
    await c.query('begin');
    const out = await fn(async (text, values = []) => (await c.query(text, values)).rows);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

// Simple per-IP limiter backed by the database.
export async function limit(ip, kind, max, windowSec) {
  const [{ n }] = await q(
    `select count(*)::int n from rate_hits where ip = $1 and kind = $2 and at > now() - make_interval(secs => $3)`,
    [ip, kind, windowSec],
  );
  if (n >= max) return false;
  await q('insert into rate_hits (ip, kind) values ($1, $2)', [ip, kind]);
  if (Math.random() < 0.02) await q(`delete from rate_hits where at < now() - interval '1 day'`);
  return true;
}

export async function close() {
  if (pool) await pool.end();
  pool = null;
  ready = null;
}
