-- Run AFTER schema.sql and random_daily_rotation.sql.
-- Each row is a reusable place; its parent points to the place one level up.
create table if not exists public.geography_nodes (
 id uuid primary key default gen_random_uuid(),
 parent_id uuid references public.geography_nodes(id) on delete restrict,
 level int not null check(level between 0 and 6),
 name text not null check(char_length(name) between 2 and 120),
 clue text not null check(char_length(clue) between 10 and 600),
 hint text not null default 'Study the geography and nearby landmarks.',
 source text not null default 'https://www.openstreetmap.org/',
 lat double precision not null check(lat between -90 and 90),
 lng double precision not null check(lng between -180 and 180),
 iso3 char(3),
 published boolean not null default true,
 created_at timestamptz not null default now(),
 unique(parent_id,name)
);
create unique index if not exists where7_country_unique on public.geography_nodes(lower(name)) where parent_id is null;
create index if not exists where7_geo_parent on public.geography_nodes(parent_id,level);
alter table public.geography_nodes enable row level security;
revoke all on public.geography_nodes from anon,authenticated;

-- The function freezes a generated seven-stage challenge in public.challenges
-- for the whole day. Existing daily assignments remain unchanged.
create or replace function public.where7_assign_daily_challenge(target_day date)
returns text language plpgsql security invoker set search_path=public as $$
declare
 selected_id text;
 selected_leaf uuid;
 current_cycle int;
 path_ids uuid[];
 node_record record;
 stages jsonb := '[]'::jsonb;
 choices jsonb;
 idx int;
 iso char(3);
 root_name text;
 leaf_name text;
 parent_lat double precision;
 parent_lng double precision;
 selected_title text;
begin
 perform pg_advisory_xact_lock(721707);
 select challenge_id into selected_id from public.daily_challenge_assignments where challenge_date=target_day;
 if found then return selected_id; end if;
 select coalesce(max(cycle),1) into current_cycle from public.daily_challenge_assignments where challenge_date<target_day;

 -- Eligible paths must have all seven linked, published ancestors.
 with recursive paths as (
   select n.id as leaf_id,n.id,n.parent_id,n.level,array[n.id] as ids,1 as depth
   from public.geography_nodes n where n.level=6 and n.published
   union all
   select p.leaf_id,n.id,n.parent_id,n.level,array[n.id]||p.ids,p.depth+1
   from paths p join public.geography_nodes n on n.id=p.parent_id
   where n.published and n.level=p.level-1 and p.depth<7
 ), eligible as (
   select leaf_id,ids from paths where depth=7 and level=0
 )
 select leaf_id,ids into selected_leaf,path_ids from eligible e
 where not exists(
   select 1 from public.daily_challenge_assignments a
   where a.cycle=current_cycle and a.challenge_id='generated-'||e.leaf_id::text
 ) order by random() limit 1;
 if selected_leaf is null then
   current_cycle:=current_cycle+1;
   with recursive paths as (
     select n.id as leaf_id,n.id,n.parent_id,n.level,array[n.id] as ids,1 as depth
     from public.geography_nodes n where n.level=6 and n.published
     union all
     select p.leaf_id,n.id,n.parent_id,n.level,array[n.id]||p.ids,p.depth+1
     from paths p join public.geography_nodes n on n.id=p.parent_id
     where n.published and n.level=p.level-1 and p.depth<7
   ) select leaf_id,ids into selected_leaf,path_ids from paths
     where depth=7 and level=0 order by random() limit 1;
 end if;
 if selected_leaf is not null then
   select iso3,name into iso,root_name from public.geography_nodes where id=path_ids[1];
   select name into leaf_name from public.geography_nodes where id=selected_leaf;
   if iso is null or iso !~ '^[A-Z]{3}$' then raise exception 'Country node requires an ISO3 code';end if;
   for idx in 1..7 loop
     select * into node_record from public.geography_nodes where id=path_ids[idx];
     if idx=1 then choices:='[]'::jsonb;
     else
       select coalesce(jsonb_agg(jsonb_build_object('id',id::text,'name',name,'lat',lat,'lng',lng)),'[]'::jsonb)
       into choices from (
         select id,name,lat,lng from public.geography_nodes
         where level=idx-1 and published and id<>node_record.id
         order by case when parent_id=node_record.parent_id then 0 else 1 end,random() limit 2
       ) other_nodes;
       choices=jsonb_build_array(jsonb_build_object('id',node_record.id::text,'name',node_record.name,'lat',node_record.lat,'lng',node_record.lng))||choices;
       -- When the library is small, show anonymous map points instead of invented place names.
       if jsonb_array_length(choices)<3 then
         choices=choices||jsonb_build_array(jsonb_build_object('id','fallback-'||idx::text,'name','Map point north','lat',least(89.9,node_record.lat+0.02),'lng',node_record.lng));
       end if;
       if jsonb_array_length(choices)<3 then
         choices=choices||jsonb_build_array(jsonb_build_object('id','fallback-s-'||idx::text,'name','Map point south','lat',greatest(-89.9,node_record.lat-0.02),'lng',node_record.lng));
       end if;
     end if;
     if idx=1 then parent_lat:=22;parent_lng:=0;end if;
     stages=stages||jsonb_build_array(jsonb_build_object(
       'level',idx-1,'label',(array['Country','State / Region','City','Area','District','Street','Building'])[idx],
       'clue',node_record.clue,'hint',node_record.hint,'source',node_record.source,'answer',node_record.name,
       'center',jsonb_build_array(parent_lng,parent_lat),
       'zoom',(array[2,5,8,11,13,15,17])[idx],
       'selection',case when idx=1 then 'country' else 'markers' end,'choices',choices
     ));
     parent_lat:=node_record.lat;parent_lng:=node_record.lng;
   end loop;
   selected_id='generated-'||selected_leaf::text;
   insert into public.challenges(id,title,description,country_iso3,status,difficulty,publish_date,stages)
   values(selected_id,leaf_name||' Expedition','Generated from reusable geography nodes',iso,'published','standard',null,stages)
   on conflict(id) do nothing;
 else
   -- Backward compatible with existing fully authored challenges.
   select c.id into selected_id from public.challenges c where c.status='published'
   and not exists(select 1 from public.daily_challenge_assignments a where a.cycle=current_cycle and a.challenge_id=c.id)
   order by random() limit 1;
   if selected_id is null then
     current_cycle:=current_cycle+1;
     select id into selected_id from public.challenges where status='published' order by random() limit 1;
   end if;
   if selected_id is null then raise exception 'No published challenges or complete seven-stage geography paths';end if;
 end if;
 insert into public.daily_challenge_assignments(challenge_date,challenge_id,cycle)
 values(target_day,selected_id,current_cycle);
 return selected_id;
end;$$;
revoke all on function public.where7_assign_daily_challenge(date) from public,anon,authenticated;
grant execute on function public.where7_assign_daily_challenge(date) to service_role;
