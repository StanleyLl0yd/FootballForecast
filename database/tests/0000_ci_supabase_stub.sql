-- Disposable PostgreSQL CI harness; deliberately simulates Supabase roles and auth.uid().
-- Never run this file against a real Supabase project.
-- Match live Supabase placement: pgcrypto is installed in extensions,
-- rather than letting 0001's IF NOT EXISTS install RPCs under public in CI.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
