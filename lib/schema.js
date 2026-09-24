// Tables are created automatically the first time the API talks to the database.
export const SCHEMA = `
create table if not exists wallet_reports (
  wallet text primary key,
  report jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists tokens (
  mint text primary key,
  symbol text,
  name text,
  icon text,
  updated_at timestamptz not null default now()
);

create table if not exists echoes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_wallet text not null,
  build text not null,
  cash_sol numeric not null default 1,
  trades int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  realized_sol numeric not null default 0,
  best_pnl_sol numeric,
  best_symbol text,
  last_trade_at timestamptz,
  created_ip text,
  created_at timestamptz not null default now()
);
create index if not exists echoes_source_idx on echoes(source_wallet);
create index if not exists echoes_ip_idx on echoes(created_ip, created_at);

create table if not exists echo_positions (
  echo_id uuid not null references echoes(id) on delete cascade,
  mint text not null,
  symbol text,
  tokens numeric not null default 0,
  cost_sol numeric not null default 0,
  opened_at timestamptz not null default now(),
  primary key (echo_id, mint)
);

create table if not exists source_trades (
  signature text not null,
  wallet text not null,
  side text not null,
  mint text not null,
  symbol text,
  sol_amount numeric,
  token_amount numeric,
  ts timestamptz not null default now(),
  primary key (signature, wallet)
);
create index if not exists source_trades_mint_idx on source_trades(mint, ts desc);

create table if not exists echo_trades (
  id bigserial primary key,
  echo_id uuid not null references echoes(id) on delete cascade,
  source_signature text,
  side text not null check (side in ('buy','sell','skip')),
  mint text not null,
  symbol text,
  sol_amount numeric,
  token_amount numeric,
  price_sol numeric,
  pnl_sol numeric,
  reason text,
  created_at timestamptz not null default now(),
  unique (echo_id, source_signature)
);
create index if not exists echo_trades_time_idx on echo_trades(created_at desc);
create index if not exists echo_trades_echo_idx on echo_trades(echo_id, created_at desc);

create table if not exists rate_hits (
  ip text not null,
  kind text not null,
  at timestamptz not null default now()
);
create index if not exists rate_hits_idx on rate_hits(ip, kind, at);

-- nobody but the server can touch these (blocks Supabase's public API if that is the host)
alter table wallet_reports enable row level security;
alter table tokens enable row level security;
alter table echoes enable row level security;
alter table echo_positions enable row level security;
alter table source_trades enable row level security;
alter table echo_trades enable row level security;
alter table rate_hits enable row level security;
`;
