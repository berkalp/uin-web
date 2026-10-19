-- API database connections can enable JIT unlike the SQL editor. For these
-- small, frequently called Library projections the compilation cost can exceed
-- the caller's statement timeout. Scope the setting to these reads; preserve
-- caller timeouts, authorization, function signatures and returned data.
alter function public.get_uin_type_placements_v177(text,integer,integer) set jit=off;
alter function public.get_uin_catalogue_for_targets_v123(uuid[]) set jit=off;
alter function public.get_uin_card_social_v87(uuid[]) set jit=off;
notify pgrst,'reload schema';
