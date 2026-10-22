-- Improvement roadmap Phase 2. Additive migration; no legacy content is labelled reviewed.
-- Apply before the matching application release. New review enforcement is activated
-- explicitly only after a reviewed 30-day schedule and reserve exist.
alter table public.challenges add column if not exists revision integer not null default 1 check(revision>0);
alter table public.challenges add column if not exists review_status text not null default 'draft' check(review_status in ('draft','in_review','approved','changes_requested'));
alter table public.challenges add column if not exists review_checklist jsonb not null default '{}'::jsonb;
alter table public.challenges add column if not exists reviewed_by uuid;
alter table public.challenges add column if not exists reviewed_at timestamptz;
alter table public.challenges add column if not exists is_reserve boolean not null default false;
create table if not exists public.challenge_revisions (
 challenge_id text not null references public.challenges(id) on delete restrict,
 revision integer not null check(revision>0),snapshot jsonb not null,
 review_status text not null check(review_status in ('draft','in_review','approved','changes_requested')),
 reviewer uuid,created_at timestamptz not null default now(),primary key(challenge_id,revision)
);
create table if not exists public.challenge_schedule (
 challenge_date date primary key,challenge_id text not null,revision integer not null,
 created_by uuid not null,created_at timestamptz not null default now(),
 foreign key(challenge_id,revision) references public.challenge_revisions(challenge_id,revision)
);
create table if not exists public.content_settings (
 singleton boolean primary key default true check(singleton),reviews_required boolean not null default false,
 activated_by uuid,activated_at timestamptz
);
insert into public.content_settings(singleton) values(true) on conflict do nothing;
create table if not exists public.challenge_replacements (
 id uuid primary key default gen_random_uuid(),challenge_date date not null,previous_snapshot jsonb not null,
 replacement_snapshot jsonb not null,reason text not null check(char_length(reason) between 15 and 1000),
 editor uuid not null,created_at timestamptz not null default now()
);
create table if not exists public.clue_reports (
 id uuid primary key default gen_random_uuid(),guest_key uuid not null,session_key text not null,
 session_mode text not null check(session_mode in ('daily','practice')),started_at timestamptz not null,
 challenge_id text not null,revision integer not null,stage integer not null check(stage between 0 and 6),
 category text not null check(category in ('inaccurate','ambiguous','map','spelling','other')),
 notes text not null default '' check(char_length(notes)<=600),
 status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
 resolution text not null default '' check(char_length(resolution)<=1000),resolved_by uuid,updated_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 foreign key(challenge_id,revision) references public.challenge_revisions(challenge_id,revision),
 unique(guest_key,session_key,session_mode,started_at,revision,stage)
);
create index if not exists clue_reports_queue on public.clue_reports(status,created_at desc);
create index if not exists clue_reports_rate on public.clue_reports(guest_key,created_at desc);
create index if not exists reviewed_content_pool on public.challenges(review_status,status,is_reserve,country_iso3);
alter table public.challenge_revisions enable row level security;
alter table public.challenge_schedule enable row level security;
alter table public.content_settings enable row level security;
alter table public.challenge_replacements enable row level security;
alter table public.clue_reports enable row level security;
revoke all on public.challenge_revisions,public.challenge_schedule,public.content_settings,public.challenge_replacements,public.clue_reports from public,anon,authenticated;
grant all on public.challenge_revisions,public.challenge_schedule,public.content_settings,public.challenge_replacements,public.clue_reports to service_role;

create or replace function public.where7_content_snapshot(c public.challenges)
returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('id',c.id,'title',c.title,'description',c.description,'countryIso3',trim(c.country_iso3),
 'status',c.status,'publishDate',c.publish_date,'difficulty',c.difficulty,'stages',c.stages,'revision',c.revision,
 'reviewStatus',c.review_status,'checklist',c.review_checklist,'reviewedAt',c.reviewed_at,'reserve',c.is_reserve);
$$;
insert into public.challenge_revisions(challenge_id,revision,snapshot,review_status)
 select c.id,c.revision,public.where7_content_snapshot(c),c.review_status from public.challenges c on conflict do nothing;
alter table public.daily_challenge_assignments add column if not exists challenge_snapshot jsonb;
update public.daily_challenge_assignments a set challenge_snapshot=public.where7_content_snapshot(c)
 from public.challenges c where c.id=a.challenge_id and a.challenge_snapshot is null;
-- Pin legacy runs before administrators can edit anything through the new workflow.
update public.game_sessions s set data=jsonb_set(s.data,'{challengeSnapshot}',public.where7_content_snapshot(c))
 from public.challenges c where c.id=s.data->>'challengeId' and not(s.data?'challengeSnapshot');

create or replace function public.where7_content_shape_ok(stages jsonb,iso text,proof boolean default true)
returns boolean language plpgsql immutable security invoker set search_path=public as $$
declare s jsonb;i integer;c jsonb;ids text[]:=array[]::text[];four_uk boolean;
begin
 if jsonb_typeof(stages)<>'array' or jsonb_array_length(stages)<>7 then return false;end if;
 for i in 0..6 loop
  s:=stages->i;
  if (s->>'level')::integer is distinct from i or char_length(trim(coalesce(s->>'clue','')))<10 or not(coalesce(s->>'source','') ~ '^https://[^/]+/.+') then return false;end if;
  if proof then
   if coalesce(s->'place'->>'id','')='' or not(coalesce(s->'place'->>'source','') ~ '^https://') then return false;end if;
   if (s->'place'->>'id')=any(ids) then return false;end if;ids:=array_append(ids,s->'place'->>'id');
   if (s->'place'->>'lat')::numeric is null or (s->'place'->>'lng')::numeric is null or abs((s->'place'->>'lat')::numeric)>90 or abs((s->'place'->>'lng')::numeric)>180 then return false;end if;
   if i=0 and s->'place'->'parentId' is distinct from 'null'::jsonb then return false;end if;
   if i>0 and (s->'place'->>'parentId' is distinct from stages->(i-1)->'place'->>'id' or not(coalesce(s->'place'->>'relationshipSource','') ~ '^https://')) then return false;end if;
   if s->>'clue' ~* 'next map area|zoom further into|final access road|cluster of nearby|shown on the map' then return false;end if;
  end if;
  if i>0 then
   if jsonb_typeof(s->'choices')<>'array' then return false;end if;
   four_uk:=i=1 and iso='GBR' and jsonb_array_length(s->'choices')=4
    and char_length(s->'choiceException'->>'reason')>=20 and s->'choiceException'->>'source' ~ '^https://'
    and (select array_agg(lower(x->>'name') order by lower(x->>'name')) from jsonb_array_elements(s->'choices') x)=array['england','northern ireland','scotland','wales'];
   if jsonb_array_length(s->'choices')<5 and not coalesce(four_uk,false) then return false;end if;
   if jsonb_array_length(s->'choices')>40 then return false;end if;
   if (select count(distinct lower(trim(x->>'name'))) from jsonb_array_elements(s->'choices') x)<>jsonb_array_length(s->'choices') then return false;end if;
   if (select count(*) from jsonb_array_elements(s->'choices') x where x->>'name'=s->>'answer')<>1 then return false;end if;
   if proof and not exists(select 1 from jsonb_array_elements(s->'choices') x where x->>'name'=s->>'answer' and x->>'id'=s->'place'->>'id') then return false;end if;
  end if;
 end loop;
 return true;
exception when others then return false;
end;$$;

create or replace function public.where7_save_content(payload jsonb,expected_revision integer,editor uuid,intent text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare existing public.challenges; saved public.challenges;next_rev integer;state text;i integer;k text;
begin
 if editor is null or intent not in ('draft','in_review','approve') then raise exception 'Invalid editorial action';end if;
 perform pg_advisory_xact_lock(hashtextextended(payload->>'id',48271));
 select * into existing from public.challenges where id=payload->>'id' for update;
 if coalesce(existing.revision,0)<>expected_revision then raise exception 'CONTENT_CONFLICT: Reload the saved revision before editing.';end if;
 next_rev:=coalesce(existing.revision,0)+1;
 state:=case when intent='approve' then 'approved' else intent end;
 if intent='approve' then
  if not public.where7_content_shape_ok(payload->'stages',payload->>'countryIso3',true) then raise exception 'Content failed publication validation';end if;
  if jsonb_array_length(payload->'checklist'->'stages') is distinct from 7 or payload->'checklist'->'mobileTested' is distinct from 'true'::jsonb then raise exception 'Complete the editorial checklist and mobile test';end if;
  for i in 0..6 loop
   foreach k in array array['facts','uniqueAnswer','source','alternatives','hierarchy','coordinates','aliases'] loop
    if payload->'checklist'->'stages'->i->k is distinct from 'true'::jsonb then raise exception 'Every stage requires editorial sign-off';end if;
   end loop;
  end loop;
  if exists(select 1 from public.challenges c where c.id<>payload->>'id' and c.review_status='approved' and c.status='published'
   and trim(c.country_iso3)=payload->>'countryIso3' and (lower(trim(c.stages->6->>'answer'))=lower(trim(payload->'stages'->6->>'answer')) or c.stages->6->'place'->>'id'=payload->'stages'->6->'place'->>'id'))
   then raise exception 'An approved challenge already uses this destination. Archive the duplicate first.';end if;
 end if;
 insert into public.challenges(id,title,description,country_iso3,difficulty,status,publish_date,stages,revision,review_status,review_checklist,reviewed_by,reviewed_at,is_reserve)
 values(payload->>'id',payload->>'title',coalesce(payload->>'description',''),payload->>'countryIso3',payload->>'difficulty',
  case when intent='approve' then 'published' else 'draft' end,null,payload->'stages',next_rev,state,coalesce(payload->'checklist','{}'),
  case when intent='approve' then editor end,case when intent='approve' then now() end,coalesce((payload->>'reserve')::boolean,false))
 on conflict(id) do update set title=excluded.title,description=excluded.description,country_iso3=excluded.country_iso3,
 difficulty=excluded.difficulty,status=excluded.status,publish_date=null,stages=excluded.stages,revision=excluded.revision,review_status=excluded.review_status,
 review_checklist=excluded.review_checklist,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,is_reserve=excluded.is_reserve,updated_at=now()
 returning * into saved;
 insert into public.challenge_revisions(challenge_id,revision,snapshot,review_status,reviewer)
 values(saved.id,saved.revision,public.where7_content_snapshot(saved),state,editor);
 return public.where7_content_snapshot(saved);
end;$$;

create or replace function public.where7_schedule_content(entries jsonb,editor uuid)
returns integer language plpgsql security invoker set search_path=public as $$
declare e jsonb;r public.challenge_revisions;day date;n integer:=0;
begin
 if editor is null or jsonb_typeof(entries)<>'array' or jsonb_array_length(entries) not between 1 and 60 then raise exception 'Choose 1–60 schedule entries';end if;
 perform pg_advisory_xact_lock(721707);
 for e in select * from jsonb_array_elements(entries) loop
  day:=(e->>'day')::date;
  if day<=(now() at time zone 'UTC')::date then raise exception 'Schedule future dates; use the replacement workflow for today.';end if;
  select * into r from public.challenge_revisions where challenge_id=e->>'challengeId' and revision=(e->>'revision')::integer;
  if not found or r.review_status<>'approved' or coalesce((r.snapshot->>'reserve')::boolean,false) then raise exception 'Schedule only approved, non-reserve revisions';end if;
  if exists(select 1 from public.daily_challenge_assignments where challenge_date=day) then raise exception 'This date already has a frozen daily assignment';end if;
  insert into public.challenge_schedule(challenge_date,challenge_id,revision,created_by)
   values(day,r.challenge_id,r.revision,editor) on conflict(challenge_date) do update set challenge_id=excluded.challenge_id,revision=excluded.revision,created_by=editor,created_at=now();
  n:=n+1;
 end loop;
 return n;
end;$$;

create or replace function public.where7_activate_quality(editor uuid)
returns boolean language plpgsql security invoker set search_path=public as $$
declare today date:=(now() at time zone 'UTC')::date;
begin
 if editor is null then raise exception 'Editor required';end if;
 if (select count(distinct s.challenge_date) from public.challenge_schedule s join public.challenge_revisions r using(challenge_id,revision)
  where s.challenge_date between today+1 and today+30 and r.review_status='approved')<>30 then raise exception 'Review and schedule the next 30 days first';end if;
 if (select count(distinct s.challenge_id) from public.challenge_schedule s join public.challenge_revisions r using(challenge_id,revision) where s.challenge_date between today+1 and today+30 and r.review_status='approved')<>30 then raise exception 'The reviewed buffer must contain 30 distinct destinations';end if;
 if not exists(select 1 from public.challenges where is_reserve and review_status='approved' and status='published') then raise exception 'An approved emergency reserve is required';end if;
 update public.content_settings set reviews_required=true,activated_by=editor,activated_at=now() where singleton;
 return true;
end;$$;

create or replace function public.where7_assign_daily_challenge(target_day date)
returns text language plpgsql security invoker set search_path=public as $$
declare selected public.challenges;frozen jsonb;selected_id text;active_cycle integer;enforced boolean;
begin
 perform pg_advisory_xact_lock(721707);
 select a.challenge_id into selected_id from public.daily_challenge_assignments a where a.challenge_date=target_day;
 if selected_id is not null then return selected_id;end if;
 select r.snapshot into frozen from public.challenge_schedule s join public.challenge_revisions r using(challenge_id,revision)
  where s.challenge_date=target_day and r.review_status='approved';
 select coalesce(max(a.cycle),1) into active_cycle from public.daily_challenge_assignments a where a.challenge_date<target_day;
 if frozen is not null then selected_id:=frozen->>'id';
 else
  select reviews_required into enforced from public.content_settings where singleton;
  select * into selected from public.challenges c where c.status='published' and not c.is_reserve
   and (not enforced or c.review_status='approved') and public.where7_content_shape_ok(c.stages,trim(c.country_iso3),enforced)
   and not exists(select 1 from public.daily_challenge_assignments a where a.cycle=active_cycle and a.challenge_id=c.id)
   order by (select count(*) from public.daily_challenge_assignments a join public.challenges old on old.id=a.challenge_id where a.challenge_date between target_day-7 and target_day-1 and old.country_iso3=c.country_iso3),random() limit 1;
  if not found then
   active_cycle:=active_cycle+1;
   select * into selected from public.challenges c where c.status='published' and not c.is_reserve
    and (not enforced or c.review_status='approved') and public.where7_content_shape_ok(c.stages,trim(c.country_iso3),enforced)
    order by (select count(*) from public.daily_challenge_assignments a join public.challenges old on old.id=a.challenge_id where a.challenge_date between target_day-7 and target_day-1 and old.country_iso3=c.country_iso3),random() limit 1;
  end if;
  if selected.id is null then raise exception 'No eligible daily content. Schedule an approved revision or review the content pool.';end if;
  selected_id:=selected.id;frozen:=public.where7_content_snapshot(selected);
 end if;
 insert into public.daily_challenge_assignments(challenge_date,challenge_id,cycle,challenge_snapshot) values(target_day,selected_id,active_cycle,frozen);
 return selected_id;
end;$$;

create or replace function public.where7_replace_daily(target_day date,expected_id text,replacement_id text,replacement_revision integer,reason text,editor uuid)
returns text language plpgsql security invoker set search_path=public as $$
declare previous public.daily_challenge_assignments;r public.challenge_revisions;
begin
 if editor is null or target_day<>(now() at time zone 'UTC')::date or char_length(trim(reason)) not between 15 and 1000 then raise exception 'Replace today only, with an editor and a specific reason';end if;
 perform pg_advisory_xact_lock(721707);
 select * into previous from public.daily_challenge_assignments where challenge_date=target_day for update;
 if not found or previous.challenge_id<>expected_id then raise exception 'Daily assignment changed; refresh before replacing';end if;
 select * into r from public.challenge_revisions where challenge_id=replacement_id and revision=replacement_revision;
 if not found or r.review_status<>'approved' or not coalesce((r.snapshot->>'reserve')::boolean,false) or r.challenge_id=previous.challenge_id then raise exception 'Choose a different approved reserve challenge';end if;
 insert into public.challenge_replacements(challenge_date,previous_snapshot,replacement_snapshot,reason,editor) values(target_day,previous.challenge_snapshot,r.snapshot,reason,editor);
 update public.daily_challenge_assignments set challenge_id=r.challenge_id,challenge_snapshot=r.snapshot where challenge_date=target_day;
 return r.challenge_id;
end;$$;

create or replace function public.where7_report_clue(reporter uuid,session_id text,game_mode text,content_revision integer,stage_index integer,report_category text,report_notes text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare s public.game_sessions;report_id uuid;day_start timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
 perform pg_advisory_xact_lock(hashtextextended(reporter::text,7217));
 select * into s from public.game_sessions where guest_key=reporter and challenge_id=session_id and mode=game_mode;
 if not found or content_revision is distinct from (s.data->'challengeSnapshot'->>'revision')::integer or stage_index<0 or stage_index>least(6,(s.data->>'stage')::integer) then raise exception 'Report only a clue you have reached in this saved revision';end if;
 select id into report_id from public.clue_reports where guest_key=reporter and session_key=session_id and session_mode=game_mode and started_at=(s.data->>'startedAt')::timestamptz and revision=content_revision and stage=stage_index;
 if report_id is not null then return report_id;end if;
 if (select count(*) from public.clue_reports where guest_key=reporter and created_at>=day_start)>=10 then raise exception 'Daily report limit reached';end if;
 insert into public.clue_reports(guest_key,session_key,session_mode,started_at,challenge_id,revision,stage,category,notes)
 values(reporter,session_id,game_mode,(s.data->>'startedAt')::timestamptz,s.data->>'challengeId',content_revision,stage_index,report_category,report_notes) returning id into report_id;
 return report_id;
end;$$;

-- Frozen revision rows cannot be silently edited or deleted.
create or replace function public.where7_revision_immutable()
returns trigger language plpgsql security invoker set search_path=public as $$begin raise exception 'Content revisions are immutable; save a new revision';end;$$;
drop trigger if exists where7_revision_immutable on public.challenge_revisions;
create trigger where7_revision_immutable before update or delete on public.challenge_revisions for each row execute function public.where7_revision_immutable();

revoke all on function public.where7_content_snapshot(public.challenges),public.where7_content_shape_ok(jsonb,text,boolean),public.where7_save_content(jsonb,integer,uuid,text),public.where7_schedule_content(jsonb,uuid),public.where7_activate_quality(uuid),public.where7_assign_daily_challenge(date),public.where7_replace_daily(date,text,text,integer,text,uuid),public.where7_report_clue(uuid,text,text,integer,integer,text,text),public.where7_revision_immutable() from public,anon,authenticated;
grant execute on function public.where7_content_snapshot(public.challenges),public.where7_content_shape_ok(jsonb,text,boolean),public.where7_save_content(jsonb,integer,uuid,text),public.where7_schedule_content(jsonb,uuid),public.where7_activate_quality(uuid),public.where7_assign_daily_challenge(date),public.where7_replace_daily(date,text,text,integer,text,uuid),public.where7_report_clue(uuid,text,text,integer,integer,text,text) to service_role;

create or replace function public.where7_editorial_metrics()
returns jsonb language sql stable security invoker set search_path=public as $$
 with starts as (
  select count(*)::int n from public.game_sessions where mode='daily' and updated_at>=now()-interval '30 days' and coalesce((data->>'guesses')::int,0)>0
 ), reports as (
  select count(*)::int n from public.clue_reports where session_mode='daily' and created_at>=now()-interval '30 days'
 ), attempts as (
  select (h->>'stage')::int stage,(h->>'correct')::boolean correct from public.game_sessions s
  cross join lateral jsonb_array_elements(coalesce(s.data->'history','[]'::jsonb)) h
  where s.mode='daily' and s.updated_at>=now()-interval '30 days'
 ), stages as (
  select stage,count(*)::int attempts,count(*) filter(where correct)::int correct from attempts group by stage order by stage
 )
 select jsonb_build_object('dailyStarts',starts.n,'clueReports',reports.n,'reportsPer1000Starts',case when starts.n>0 then round(reports.n*1000.0/starts.n,1) else null end,
 'stages',coalesce((select jsonb_agg(to_jsonb(stages)) from stages),'[]'::jsonb),
 'reviewMinutesAverage',(select round(avg((review_checklist->>'minutesSpent')::numeric),1) from public.challenges where review_status='approved' and jsonb_typeof(review_checklist->'minutesSpent')='number')) from starts,reports;
$$;
revoke all on function public.where7_editorial_metrics() from public,anon,authenticated;
grant execute on function public.where7_editorial_metrics() to service_role;
