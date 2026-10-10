begin;

-- Public profiles render only rows explicitly marked `is_public`. The original
-- v2921 migration grouped this read-only function with private preference
-- helpers and accidentally limited every function in the group to signed-in
-- users. Keep the privilege boundary explicit: no PUBLIC grant and no access
-- to sibling private or mutating functions.
revoke all
on function public.get_public_preferences_v2921(text)
from public;

grant execute
on function public.get_public_preferences_v2921(text)
to anon, authenticated;

notify pgrst, 'reload schema';

commit;
