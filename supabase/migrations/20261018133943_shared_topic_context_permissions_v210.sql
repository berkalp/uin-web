-- This helper is only used inside the visibility-checked people RPC.
revoke all on function public.get_uin_card_intent_contexts_v210(uuid[]) from public,anon,authenticated;
grant execute on function public.get_uin_card_intent_contexts_v210(uuid[]) to service_role;

