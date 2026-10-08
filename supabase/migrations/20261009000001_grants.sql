-- Explicit Data API grants. This project does not auto-expose new tables to the API roles
-- (auto_expose_new_tables is off), so every object the app or the crawler touches needs a grant.
-- RLS still governs which rows are visible/writable; grants only open the object to the role.

grant usage on schema public to anon, authenticated, service_role;

-- roster: readable by everyone, written only through migrations
grant select on public.members to anon, authenticated, service_role;

-- trip rows: the trust-based member editing decided in T7 (decision 1a)
grant select, insert, update on public.member_trip to anon, authenticated;
grant select, insert, update, delete on public.member_trip to service_role;

-- derived views used by the app and the admin screen
grant select on public.v_member_nights     to anon, authenticated, service_role;
grant select on public.v_member_stay       to anon, authenticated, service_role;
grant select on public.v_headcount_per_day to anon, authenticated, service_role;

-- crawler storage: readable by the app, written by the secret key only
grant select on public.flight_searches, public.crawl_runs, public.fare_offers to anon, authenticated, service_role;
grant select on public.latest_fares, public.cheapest_by_date to anon, authenticated, service_role;
grant select, insert, update, delete on public.flight_searches, public.crawl_runs, public.fare_offers to service_role;
grant usage, select on all sequences in schema public to service_role;
