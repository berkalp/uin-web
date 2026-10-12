begin;
-- PostgreSQL's uncorrelated scalar subquery evaluates the viewer's admin role
-- once per statement, rather than once per catalogue row.
do $patch$ declare function_row record;definition text;begin
 for function_row in select oid from pg_proc where pronamespace='public'::regnamespace and proname in ('get_uin_category_counts_v129','get_uin_card_content_types_v177','get_uin_type_placements_v177','search_uin_category_topics_v177') loop
 definition:=pg_get_functiondef(function_row.oid);
 definition:=replace(definition,'public.is_admin()','(select public.is_admin())');
 execute definition;
 end loop;
end;$patch$;
analyze public.uin_card_content_types_v177;
notify pgrst,'reload schema';
commit;
