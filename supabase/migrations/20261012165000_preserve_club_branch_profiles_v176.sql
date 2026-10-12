begin;
-- Legacy team keys can occur in several clubs. Moving/editing one branch must
-- update only its own previous parent, rather than every club with that key.
do $patch$
declare definition text; original_clause text:='where id<>parent_id and id<>p_target_id and';
begin
 select pg_get_functiondef('public.admin_save_club_card_v75(uuid,text,text,text,text,text,text,jsonb,numeric,jsonb)'::regprocedure) into definition;
 if position('previous_parent_id uuid' in definition)>0 then return;end if;
 if position(original_clause in definition)=0 then raise exception 'Unexpected club editor definition';end if;
 definition:=regexp_replace(definition,'\mdeclare\M','declare previous_parent_id uuid;','i');
 definition:=regexp_replace(definition,'\mbegin\M',$insert$begin
 select nullif(editorial_metadata->'club_hierarchy'->>'parent_target_id','')::uuid into previous_parent_id from public.canonical_targets where id=p_target_id;
 $insert$,'i');
 definition:=replace(definition,original_clause,'where id=previous_parent_id and id<>parent_id and id<>p_target_id and');
 execute definition;
end;$patch$;
commit;
