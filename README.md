# echoes

Paste any Solana wallet. The lab reads its real on-chain trades, grows a pixel echo with the same habits, and the echo copies every new trade that wallet makes, live, with paper SOL.

- No wallet connect, no deposits, no keys. Echoes trade paper SOL only.
- Wallet history and live trades come from Helius. Prices come from Jupiter, with DexScreener as backup.
- Every echo decision is stored with its reason in Postgres.

## Setup (Vercel)

1. Project → **Storage** → **Create Database** → **Neon** (free) → connect it to this project.
2. Project → **Settings → Environment Variables** → add `HELIUS_API_KEY`.
3. Redeploy. Tables are created automatically on the first request.

Optional: `PUBLIC_URL` (defaults to the production domain), `MAX_ECHOES` (default 1000).

## Layout

- `public/` the site (`index.html` is built from `src/` by `node build.mjs`, `config.js` holds the CA and links)
- `api/` serverless endpoints: `analyze`, `echo`, `echoes`, `agent`, `feed`, `stats`, `webhook`
- `lib/` Helius parsing, wallet analysis, copy strategy, paper trading, prices, database
- `tests/` unit + integration tests (need a local Postgres on port 5433): `node --test --test-concurrency=1 tests/*.test.js`
- `preview/` sample-data simulator used only for design previews
