-- Phase 5: curated-only daily selection. New geography nodes must be authored
-- into a verified five-option challenge before entering the public rotation.
create or replace function public.where7_assign_daily_challenge(target_day date)
returns text language plpgsql security invoker set search_path=public as $phase5$
declare
  selected_id text;
  active_cycle integer;
begin
  perform pg_advisory_xact_lock(721707);
  select a.challenge_id into selected_id from public.daily_challenge_assignments a
    where a.challenge_date=target_day;
  if selected_id is not null then return selected_id; end if;
  select coalesce(max(a.cycle),1) into active_cycle from public.daily_challenge_assignments a
    where a.challenge_date<target_day;
  with eligible as (
    select c.id,c.country_iso3 from public.challenges c
    where c.status='published' and jsonb_array_length(c.stages)=7
      and not exists (
        select 1 from jsonb_array_elements(c.stages) with ordinality s(stage,n)
        where s.n>1 and (
          jsonb_array_length(s.stage->'choices')<>5 or
          (select count(distinct lower(trim(choice->>'name'))) from jsonb_array_elements(s.stage->'choices') choice)<>5 or
          (select count(*) from jsonb_array_elements(s.stage->'choices') choice where choice->>'name'=s.stage->>'answer')<>1
        )
      )
  )
  select e.id into selected_id from eligible e
   where not exists(select 1 from public.daily_challenge_assignments a
      where a.cycle=active_cycle and a.challenge_id=e.id)
   order by
      (select count(*) from public.daily_challenge_assignments prev
       join public.challenges old_c on old_c.id=prev.challenge_id
       where prev.challenge_date between target_day-7 and target_day-1
       and old_c.country_iso3=e.country_iso3),
      random()
   limit 1;
  if selected_id is null then
    active_cycle:=active_cycle+1;
    with eligible as (
      select c.id,c.country_iso3 from public.challenges c
      where c.status='published' and jsonb_array_length(c.stages)=7
      and not exists (
        select 1 from jsonb_array_elements(c.stages) with ordinality s(stage,n)
        where s.n>1 and (
          jsonb_array_length(s.stage->'choices')<>5 or
          (select count(distinct lower(trim(choice->>'name'))) from jsonb_array_elements(s.stage->'choices') choice)<>5 or
          (select count(*) from jsonb_array_elements(s.stage->'choices') choice where choice->>'name'=s.stage->>'answer')<>1
        )
      )
    )
    select e.id into selected_id from eligible e
    order by (select count(*) from public.daily_challenge_assignments a
      join public.challenges c on c.id=a.challenge_id
      where a.challenge_date between target_day-7 and target_day-1 and c.country_iso3=e.country_iso3),random() limit 1;
  end if;
  if selected_id is null then raise exception 'No published and verified five-choice challenges are available.'; end if;
  insert into public.daily_challenge_assignments(challenge_date,challenge_id,cycle)
    values(target_day,selected_id,active_cycle);
  return selected_id;
end;$phase5$;
revoke all on function public.where7_assign_daily_challenge(date) from public,anon,authenticated;
grant execute on function public.where7_assign_daily_challenge(date) to service_role;
