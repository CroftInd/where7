-- Run AFTER schema.sql. No passwords are stored here: Supabase Auth owns authentication.
create table if not exists public.player_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Explorer' check(char_length(display_name) between 2 and 24),
 xp bigint not null default 0 check(xp>=0),
 created_at timestamptz not null default now()
);
alter table public.player_profiles enable row level security;
revoke all on public.player_profiles from anon,authenticated;
-- Server-side XP is recomputed on each completed daily result change, so it
-- cannot be increased by sending arbitrary XP from a browser.
create or replace function public.where7_update_player_xp() returns trigger
language plpgsql security definer set search_path=public as $$
declare who uuid;
begin
  if TG_OP='DELETE' then who=old.guest_key; else who=new.guest_key; end if;
  if exists(select 1 from auth.users where id=who) then
    insert into public.player_profiles(id) values(who) on conflict(id) do nothing;
    update public.player_profiles set xp=coalesce((
      select sum(greatest(0,floor(score/10)::bigint)) from public.results
      where guest_key=who and mode='daily' and finished_at is not null
    ),0) where id=who;
  end if;
  return null;
end;$$;
drop trigger if exists where7_result_xp on public.results;
create trigger where7_result_xp after insert or update or delete on public.results
for each row execute function public.where7_update_player_xp();
-- Backfill accounts that already have completed results.
insert into public.player_profiles(id)
select distinct r.guest_key from public.results r join auth.users u on u.id=r.guest_key
on conflict(id) do nothing;
update public.player_profiles p set xp=coalesce((
 select sum(greatest(0,floor(r.score/10)::bigint)) from public.results r
 where r.guest_key=p.id and r.mode='daily' and r.finished_at is not null
),0);
