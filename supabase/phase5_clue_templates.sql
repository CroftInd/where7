create table if not exists public.geography_clue_templates(
 id uuid primary key default gen_random_uuid(),
 level integer not null check(level between 0 and 6),
 title text not null check(length(title) between 3 and 60),
 clue text not null check(length(clue) between 10 and 600),
 hint text not null default '',
 created_at timestamptz not null default now(),
 unique(level,title)
);
alter table public.geography_clue_templates enable row level security;
revoke all on public.geography_clue_templates from public,anon,authenticated;
grant select,insert,update,delete on public.geography_clue_templates to service_role;