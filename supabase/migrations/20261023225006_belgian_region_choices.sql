-- Complete, finite geographic sets. Belgium has three regions: https://www.belgium.be/en/about_belgium/government/regions
-- Keep the five-choice default; accept only this exact, documented complete set.
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
   four_uk:=i=1 and char_length(s->'choiceException'->>'reason')>=20
    and s->'choiceException'->>'source' ~ '^https://' and (
      (iso='GBR' and jsonb_array_length(s->'choices')=4
       and (select array_agg(lower(x->>'name') order by lower(x->>'name')) from jsonb_array_elements(s->'choices') x)=array['england','northern ireland','scotland','wales'])
      or (iso='BEL' and jsonb_array_length(s->'choices')=3
       and (select array_agg(lower(x->>'name') order by lower(x->>'name')) from jsonb_array_elements(s->'choices') x)=array['brussels-capital region','flemish region','walloon region'])
      or (iso='IRL' and jsonb_array_length(s->'choices')=4
       and (select array_agg(lower(x->>'name') order by lower(x->>'name')) from jsonb_array_elements(s->'choices') x)=array['connacht','leinster','munster','ulster'])
    );
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

revoke all on function public.where7_content_shape_ok(jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.where7_content_shape_ok(jsonb,text,boolean) to service_role;
