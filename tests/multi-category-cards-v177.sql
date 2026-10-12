begin;
do $test$ declare memberships jsonb;category text;rows jsonb;viewer uuid;first_wish uuid;second_wish uuid;begin
 memberships:=public.get_uin_card_content_types_v177(array['33ec7aea-0891-4478-b1fb-ae2fc52a55bc','8620f712-bfff-4416-ba7c-2733a6010288']::uuid[]);
 if jsonb_array_length(memberships)<>2 then raise exception 'Missing example card';end if;
 foreach category in array array['hobby','activity','writer'] loop
 rows:=public.get_uin_type_placements_v177(category,500,0);
 if (select count(*) from jsonb_array_elements(rows) row where row->>'canonical_target_id' in ('33ec7aea-0891-4478-b1fb-ae2fc52a55bc','8620f712-bfff-4416-ba7c-2733a6010288'))<>2 then raise exception 'Missing or duplicate category placement: %',category;end if;
 if (select count(*) from jsonb_array_elements(public.search_uin_category_topics_v177('Doğa Fotoğrafçılığı',category,24)) row where row->>'canonicalTargetId'='33ec7aea-0891-4478-b1fb-ae2fc52a55bc')<>1 then raise exception 'Secondary category search failed: %',category;end if;
 end loop;
 begin perform public.admin_save_uin_card_content_types_v177('33ec7aea-0891-4478-b1fb-ae2fc52a55bc',array['hobby']);raise exception 'Anonymous edit was allowed';exception when insufficient_privilege then null;end;
 select id into viewer from auth.users order by created_at limit 1;
 perform set_config('request.jwt.claim.sub',viewer::text,true);
 first_wish:=public.save_my_contextual_personal_intent_v177('33ec7aea-0891-4478-b1fb-ae2fc52a55bc',p_content_type_id=>'writer');
 second_wish:=public.save_my_contextual_personal_intent_v177('33ec7aea-0891-4478-b1fb-ae2fc52a55bc',p_content_type_id=>'hobby');
 if first_wish<>second_wish then raise exception 'Purpose change duplicated a personal wish';end if;
 if not exists(select 1 from public.canonical_personal_intents_v38 where id=first_wish and user_id=viewer and content_type_id='hobby') then raise exception 'Purpose was not saved';end if;
 begin perform public.save_my_contextual_personal_intent_v177('33ec7aea-0891-4478-b1fb-ae2fc52a55bc',p_content_type_id=>'book');raise exception 'Unrelated category was allowed';exception when invalid_parameter_value then null;end;
 if (select editorial_metadata->>'content_type_id' from public.canonical_targets where id='33ec7aea-0891-4478-b1fb-ae2fc52a55bc')<>'hobby' then raise exception 'Canonical primary was modified';end if;
end;$test$;
rollback;
select 'multi-category identities, search, permissions and contextual wish tests passed' result;
