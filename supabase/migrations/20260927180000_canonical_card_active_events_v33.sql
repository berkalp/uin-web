-- Count active social events once per canonical UIN card, across every user's seed.

create or replace function public.get_uin_card_active_counts_v33(p_target_ids uuid[])
returns table(target_id uuid, active bigint)
language sql
security definer
set search_path = public
stable
as $function$
  with requested as (
    select distinct value as target_id
    from unnest(coalesce(p_target_ids, array[]::uuid[])) as value
  )
  select
    requested.target_id,
    count(distinct intent.id) filter (
      where intent.id is not null
        and coalesce(intent.status, 'open') not in ('completed', 'cancelled', 'canceled', 'expired', 'closed')
        and coalesce(intent.visibility, 'public') in ('public', 'everyone')
    )::bigint as active
  from requested
  left join public.seed_catalog_items item
    on item.canonical_target_id = requested.target_id
  left join public.seeds seed
    on seed.catalog_item_id = item.id
  left join public.seed_intent_links link
    on link.seed_id = seed.id
  left join public.intents intent
    on intent.id = link.intent_id
  group by requested.target_id;
$function$;
revoke all on function public.get_uin_card_active_counts_v33(uuid[]) from public;
grant execute on function public.get_uin_card_active_counts_v33(uuid[]) to anon, authenticated;
