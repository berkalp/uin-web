begin;

drop function if exists public.get_community_discovery_metrics(uuid);

drop function if exists public.search_communities_v2(
  text,
  uuid,
  uuid,
  uuid,
  text,
  boolean,
  boolean,
  text,
  integer,
  integer
);

drop function if exists public.get_community_discovery_metrics_internal(uuid);

notify pgrst, 'reload schema';

commit;
