-- One authenticated read for navigation counts. Existing visibility/deduplication
-- functions remain authoritative; do not fetch covers, journals or social lists.
create or replace function public.get_my_mobile_personal_scope_snapshot()
returns jsonb language plpgsql stable security invoker
set search_path = public, pg_temp set jit = off
as $$
declare
  seed_rows jsonb; personal_rows jsonb; plan_rows jsonb;
  resolved_rows jsonb; memberships jsonb; target_ids uuid[];
begin
  if auth.uid() is null then raise exception 'Oturum gerekli.' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'canonical_target_id',s->'canonical_target_id','status',s->'status')), '[]'::jsonb)
  into seed_rows from public.get_my_canonical_seeds_v31(null) s;
  select coalesce(jsonb_agg(jsonb_build_object(
    'target_id',p->'target_id','type_id',p->'type_id',
    'start_date',p->'start_date','end_date',p->'end_date','location',p->'location')), '[]'::jsonb)
  into personal_rows from public.get_my_uin_personal_cards_v57() p;
  select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
  into plan_rows from public.get_my_uin_active_plan_topics_v153() p;
  select array_agg(distinct id) into target_ids from (
    select (s->>'canonical_target_id')::uuid id from jsonb_array_elements(seed_rows) s
    union select (p->>'target_id')::uuid from jsonb_array_elements(personal_rows) p
    union select (p->>'target_id')::uuid from jsonb_array_elements(plan_rows) p
  ) t;
  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into resolved_rows
  from public.resolve_uin_card_targets_v143(coalesce(target_ids,'{}'::uuid[])) r;
  select array_agg(distinct (r->>'resolved_id')::uuid) into target_ids
  from jsonb_array_elements(resolved_rows) r;
  select public.get_uin_card_content_types_v177(coalesce(target_ids,'{}'::uuid[])) into memberships;
  return jsonb_build_object('user_id',auth.uid(),'seeds',seed_rows,'personal',personal_rows,
    'plans',plan_rows,'resolved',resolved_rows,'memberships',coalesce(memberships,'[]'::jsonb));
end $$;
revoke all on function public.get_my_mobile_personal_scope_snapshot() from public, anon;
grant execute on function public.get_my_mobile_personal_scope_snapshot() to authenticated;
