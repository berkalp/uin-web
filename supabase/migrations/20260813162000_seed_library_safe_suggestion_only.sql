begin;

-- UIN Seed Library safety invariant
-- A Private Seed must never be attached by the client to an arbitrary existing
-- Library subject. Users may only submit their Private Seed through the moderated
-- suggestion flow. That flow may resolve to an existing subject only when the
-- canonical deduplication logic identifies the same subject; otherwise it creates
-- a pending Library suggestion for review.

revoke execute
on function public.connect_my_private_seed_to_catalog(uuid, uuid)
from public, anon, authenticated;

-- Keep the moderated/safe entry point available to signed-in users.
grant execute
on function public.suggest_and_connect_my_private_seed(
  uuid,
  uuid,
  text,
  text,
  text,
  integer,
  text,
  text
)
to authenticated;

comment on function public.connect_my_private_seed_to_catalog(uuid, uuid) is
  'Internal helper only. Direct client execution is revoked so a Private Seed cannot be attached to an arbitrary Library subject.';

comment on function public.suggest_and_connect_my_private_seed(uuid, uuid, text, text, text, integer, text, text) is
  'Safe client entry point for proposing a Private Seed to the moderated Seed Library. Exact canonical matches may reuse an existing subject; otherwise a pending subject is created.';

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception
  when others then
    null;
end;
$$;

commit;
