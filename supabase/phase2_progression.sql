-- WHERE7 Phase 2 — additive account rewards and streak protection.
-- Private ledgers; application server uses SUPABASE_SERVICE_ROLE_KEY.
-- Deploy BEFORE enabling /api/progression. Safe to re-run.

create table if not exists public.player_reward_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_key text not null check (reward_key ~ '^[dw]:[0-9]{4}-[0-9]{2}-[0-9]{2}:[a-z]+$'),
  xp integer not null check (xp between 1 and 500),
  shield_granted boolean not null default false,
  claimed_at timestamptz not null default now(),
  primary key (user_id,reward_key)
);
create index if not exists player_reward_claims_time_idx on public.player_reward_claims(user_id,claimed_at desc);
alter table public.player_reward_claims enable row level security;
revoke all on table public.player_reward_claims from public,anon,authenticated;

create table if not exists public.player_streak_protections (
  user_id uuid not null references auth.users(id) on delete cascade,
  protected_date date not null,
  used_at timestamptz not null default now(),
  primary key (user_id,protected_date)
);
alter table public.player_streak_protections enable row level security;
revoke all on table public.player_streak_protections from public,anon,authenticated;

-- Preserve legacy XP from validated daily game results and add claimed mission XP.
-- This is the single authoritative recalculation used by both result and reward triggers.
create or replace function public.where7_recompute_account_xp(p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from auth.users u where u.id=p_user_id) then return; end if;
  insert into public.player_profiles(id) values(p_user_id) on conflict(id) do nothing;
  update public.player_profiles p set xp=
    coalesce((select sum(greatest(0,floor(r.score/10)::bigint)) from public.results r
      where r.guest_key=p_user_id and r.mode='daily' and r.finished_at is not null),0)
    +coalesce((select sum(c.xp::bigint) from public.player_reward_claims c
      where c.user_id=p_user_id),0)
  where p.id=p_user_id;
end;$$;
revoke all on function public.where7_recompute_account_xp(uuid) from public,anon,authenticated;

-- Replace V12's XP trigger so result updates cannot erase mission XP.
create or replace function public.where7_update_player_xp()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform public.where7_recompute_account_xp(case when TG_OP='DELETE' then old.guest_key else new.guest_key end);
  return null;
end;$$;
revoke all on function public.where7_update_player_xp() from public,anon,authenticated;

drop trigger if exists where7_result_xp on public.results;
create trigger where7_result_xp after insert or update or delete on public.results
for each row execute function public.where7_update_player_xp();

create or replace function public.where7_update_claim_xp()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform public.where7_recompute_account_xp(case when TG_OP='DELETE' then old.user_id else new.user_id end);
  return null;
end;$$;
revoke all on function public.where7_update_claim_xp() from public,anon,authenticated;

drop trigger if exists where7_reward_claim_xp on public.player_reward_claims;
create trigger where7_reward_claim_xp after insert or update or delete on public.player_reward_claims
for each row execute function public.where7_update_claim_xp();

-- Explicitly restore legacy XP plus mission XP for pre-existing accounts.
do $$ declare record_id uuid; begin
  for record_id in select id from public.player_profiles loop
    perform public.where7_recompute_account_xp(record_id);
  end loop;
end $$;

-- Explicit service-role privileges for installations with restricted defaults.
grant select, insert, update, delete on table public.player_reward_claims to service_role;
grant select, insert, update, delete on table public.player_streak_protections to service_role;
