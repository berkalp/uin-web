begin;

drop function if exists public.get_public_visible_intent_presentation_context(uuid[]);
drop function if exists public.resolve_public_community_sport_cover(uuid, uuid);

notify pgrst, 'reload schema';

commit;
