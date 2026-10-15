-- PostgREST runs STABLE RPCs in a read-only transaction. This bundle calls
-- get_public_reputation_summary, which refreshes due feedback and reputation.
-- Preserve its established behavior and existing invoker permissions.
alter function public.get_mobile_profile_snapshot(text) volatile;
notify pgrst, 'reload schema';
