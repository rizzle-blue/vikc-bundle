-- The three event views created in 20261009000003 were granted to anon/authenticated only, so the
-- operator scripts (service role) could not read them. Grant to all three API roles.
grant select on public.v_event_signup_counts to anon, authenticated, service_role;
grant select on public.v_member_signups       to anon, authenticated, service_role;
grant select on public.v_member_entry_count   to anon, authenticated, service_role;
