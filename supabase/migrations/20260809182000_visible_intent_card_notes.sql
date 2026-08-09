begin;

create or replace function public.get_visible_intent_card_notes(
  p_intent_ids uuid[]
)
returns table (
  intent_id uuid,
  notes text
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    intent.id as intent_id,
    nullif(btrim(intent.notes), '') as notes
  from unnest(coalesce(p_intent_ids, '{}'::uuid[]))
    with ordinality requested(intent_id, position)
  join public.intents intent
    on intent.id = requested.intent_id
  where public.can_user_view_intent_activity(
    intent.id,
    auth.uid()
  )
  order by requested.position;
$function$;

revoke all on function public.get_visible_intent_card_notes(uuid[]) from public;
grant execute on function public.get_visible_intent_card_notes(uuid[]) to authenticated;

comment on function public.get_visible_intent_card_notes(uuid[]) is
  'Returns visibility-checked Intent notes for compact Discover card Details views.';

notify pgrst, 'reload schema';

commit;
