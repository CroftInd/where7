-- WHERE7 random daily challenge rotation. Run once in Supabase SQL Editor.
-- The service-role server API calls this function. Browser users cannot.
create table if not exists public.daily_challenge_assignments (
  challenge_date date primary key,
  challenge_id text not null references public.challenges(id) on delete restrict,
  cycle integer not null default 1,
  assigned_at timestamptz not null default now()
);
create index if not exists daily_assignment_cycle on public.daily_challenge_assignments(cycle, challenge_id);
alter table public.daily_challenge_assignments enable row level security;
revoke all on public.daily_challenge_assignments from anon, authenticated;

create or replace function public.where7_assign_daily_challenge(target_day date)
returns text language plpgsql security invoker set search_path = public as $$
declare
  selected_id text;
  current_cycle integer;
begin
  -- Serialize concurrent requests so everyone sees the same daily puzzle.
  perform pg_advisory_xact_lock(721707);
  select challenge_id into selected_id
    from public.daily_challenge_assignments where challenge_date = target_day;
  if found then return selected_id; end if;

  if not exists (select 1 from public.challenges where status='published') then
    raise exception 'No published challenges. Publish at least one challenge in the admin studio.';
  end if;

  select coalesce(max(cycle),1) into current_cycle
    from public.daily_challenge_assignments where challenge_date < target_day;

  -- Try an unused published challenge in the current cycle.
  select c.id into selected_id
    from public.challenges c
    where c.status='published'
      and not exists (
        select 1 from public.daily_challenge_assignments a
        where a.cycle=current_cycle and a.challenge_id=c.id
      )
    order by random() limit 1;

  if selected_id is null then
    current_cycle := current_cycle + 1;
    select id into selected_id from public.challenges
      where status='published' order by random() limit 1;
  end if;

  insert into public.daily_challenge_assignments(challenge_date,challenge_id,cycle)
    values(target_day,selected_id,current_cycle);
  return selected_id;
end;
$$;
revoke all on function public.where7_assign_daily_challenge(date) from public, anon, authenticated;
grant execute on function public.where7_assign_daily_challenge(date) to service_role;
