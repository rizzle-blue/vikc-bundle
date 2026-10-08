-- Flight-fare crawler storage. Writes: service role only (the local hourly crawl's .env). Reads: public.

create table public.flight_searches (
  id          bigint generated always as identity primary key,
  origin      char(3) not null,
  destination char(3) not null,
  depart_date date    not null,
  return_date date,
  adults      int     not null default 1 check (adults between 1 and 9),
  active      boolean not null default true,
  label       text,
  created_at  timestamptz not null default now(),
  unique nulls not distinct (origin, destination, depart_date, return_date, adults)
);

create table public.crawl_runs (
  id          bigint generated always as identity primary key,
  provider    text not null,
  search_id   bigint references public.flight_searches(id) on delete set null,
  started_at  timestamptz not null,
  finished_at timestamptz not null,
  status      text not null check (status in ('ok', 'empty', 'blocked', 'error', 'skipped')),
  error       text,
  offer_count int  not null default 0
);
create index crawl_runs_started_idx on public.crawl_runs (started_at desc);

create table public.fare_offers (
  id             bigint generated always as identity primary key,
  run_id         bigint not null references public.crawl_runs(id) on delete cascade,
  search_id      bigint references public.flight_searches(id) on delete set null,
  provider       text not null,
  kind           text not null check (kind in ('calendar', 'itinerary')),
  airline_code   text not null,
  airline_name   text,
  flight_no      text,
  origin         char(3) not null,
  destination    char(3) not null,
  depart_date    date not null,
  return_date    date,
  depart_at      timestamptz,
  arrive_at      timestamptz,
  duration_min   int,
  stops          int,
  cabin          text,
  price_amount   numeric(14, 2) not null,
  price_currency char(3) not null,
  fx_rate        numeric(14, 6),
  price_vnd      bigint,
  dedupe_key     text not null,
  fetched_at     timestamptz not null default now(),
  -- one row per offer per Vietnam calendar day (kept for day-level charts)
  fetched_day    date generated always as ((fetched_at at time zone 'Asia/Ho_Chi_Minh')::date) stored,
  -- one row per offer per Vietnam clock hour: hourly re-crawls overwrite, hourly price history kept
  fetched_hour   timestamptz generated always as
                   (date_trunc('hour', fetched_at at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh') stored,
  unique (dedupe_key, fetched_hour)
);
create index fare_offers_route_idx on public.fare_offers (origin, destination, depart_date, return_date);
create index fare_offers_fetched_idx on public.fare_offers (fetched_at desc);

create view public.latest_fares with (security_invoker = true) as
select distinct on (dedupe_key) *
from public.fare_offers
order by dedupe_key, fetched_at desc;

create view public.cheapest_by_date with (security_invoker = true) as
select origin, destination, depart_date, return_date, provider,
       min(price_vnd) as min_price_vnd,
       count(*)       as offer_count,
       max(fetched_at) as fetched_at
from public.latest_fares
group by origin, destination, depart_date, return_date, provider;

alter table public.flight_searches enable row level security;
alter table public.crawl_runs      enable row level security;
alter table public.fare_offers     enable row level security;

create policy "public read" on public.flight_searches for select to anon, authenticated using (true);
create policy "public read" on public.crawl_runs      for select to anon, authenticated using (true);
create policy "public read" on public.fare_offers     for select to anon, authenticated using (true);
