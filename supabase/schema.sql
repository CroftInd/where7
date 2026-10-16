-- Run in Supabase > SQL Editor. This schema deliberately exposes no public write policies;
-- all gameplay and publishing writes run via service role in server-only API routes.
create extension if not exists pgcrypto;
create table if not exists public.challenges (
  id text primary key,
  title text not null,
  description text not null default '',
  country_iso3 char(3) not null,
  difficulty text not null default 'standard' check (difficulty in ('easy','standard','expert')),
  status text not null default 'draft' check (status in ('draft','published')),
  publish_date date,
  stages jsonb not null check (jsonb_typeof(stages)='array' and jsonb_array_length(stages)=7),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index if not exists one_daily_challenge on public.challenges(publish_date) where publish_date is not null and status='published';
create table if not exists public.game_sessions (
  guest_key uuid not null,
  challenge_id text not null,
  mode text not null check (mode in ('daily','practice')),
  data jsonb not null,
  version int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (guest_key,challenge_id,mode)
);
create table if not exists public.results (
  guest_key uuid not null,
  challenge_id text not null,
  mode text not null,
  score int not null check(score>=0),
  guesses int not null check(guesses between 0 and 7),
  stage int not null check(stage between 0 and 7),
  perfect boolean not null default false,
  display_name text not null default 'Explorer' check (char_length(display_name) <= 24),
  finished_at timestamptz,
  primary key (guest_key,challenge_id,mode)
);
create index if not exists results_daily_rank on public.results(challenge_id,perfect desc,score desc);
-- RLS denies access to anonymous/authenticated API keys and browser clients.
-- The server-only service role bypasses RLS and validates guesses itself.
alter table public.challenges enable row level security;
alter table public.game_sessions enable row level security;
alter table public.results enable row level security;
revoke all on public.challenges,public.game_sessions,public.results from anon,authenticated;

-- If you created the schema before adding leaderboard names:
alter table public.results add column if not exists display_name text not null default 'Explorer';
