begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
create or replace function public.get_personal_intent_collaboration_v2918(p_seed_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_visibility text;
  v_seed_status text;
  v_mode text;
  v_friend boolean := false;
  v_blocked boolean := false;
  v_status text;
  v_rows jsonb := '[]'::jsonb;
begin
  select s.user_id, coalesce(s.visibility, 'private'), coalesce(s.status, 'active')
    into v_owner, v_visibility, v_seed_status
  from public.seeds s
  where s.id = p_seed_id;

  if not found then
    raise exception 'Kişisel Niyet bulunamadı.';
  end if;

  select suggestion_mode
    into v_mode
  from public.personal_intent_collaboration_settings
  where seed_id = p_seed_id;
  v_mode := coalesce(v_mode, 'off');

  if v_user is not null and v_user <> v_owner then
    select exists(
      select 1
      from public.get_my_friendships() f
      where to_jsonb(f)->>'other_user_id' = v_owner::text
        and to_jsonb(f)->>'friendship_status' = 'accepted'
    ) into v_friend;

    v_blocked := public.is_user_discovery_blocked_v2918(v_owner, v_user)
      or public.is_user_discovery_blocked_v2918(v_user, v_owner);

    select x.status
      into v_status
    from public.personal_intent_collaboration_suggestions x
    where x.seed_id = p_seed_id
      and x.requester_user_id = v_user;
  end if;

  if v_user = v_owner then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id,
      'requester_user_id', x.requester_user_id,
      'status', x.status,
      'created_at', x.created_at,
      'full_name', p.full_name,
      'username', p.username,
      'avatar_url', p.avatar_url
    ) order by x.created_at desc), '[]'::jsonb)
      into v_rows
    from public.personal_intent_collaboration_suggestions x
    left join public.profiles p on p.id = x.requester_user_id
    where x.seed_id = p_seed_id
      and x.status = 'pending';
  end if;

  return jsonb_build_object(
    'mode', v_mode,
    'is_owner', v_user = v_owner,
    'can_suggest', v_user is not null
      and v_user <> v_owner
      and v_seed_status <> 'completed'
      and not v_blocked
      and v_status is null
      and (
        v_visibility in ('everyone', 'public')
        or (v_mode = 'friends' and v_friend)
      ),
    'viewer_status', v_status,
    'pending', v_rows
  );
end
$$;
create or replace function public.create_personal_intent_collaboration_suggestion_v2918(p_seed_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_visibility text;
  v_mode text;
  v_friend boolean := false;
  v_id uuid;
  v_requester_name text;
begin
  if v_user is null then
    raise exception 'Oturum gerekli.';
  end if;

  select s.user_id, coalesce(s.visibility, 'private'), coalesce(x.suggestion_mode, 'off')
    into v_owner, v_visibility, v_mode
  from public.seeds s
  left join public.personal_intent_collaboration_settings x on x.seed_id = s.id
  where s.id = p_seed_id
    and coalesce(s.status, 'active') <> 'completed';

  if not found then
    raise exception 'Bu Niyet bulunamadı veya tamamlanmış.';
  end if;

  if v_owner = v_user then
    raise exception 'Kendi Niyetin için öneri gönderemezsin.';
  end if;

  if public.is_user_discovery_blocked_v2918(v_owner, v_user)
    or public.is_user_discovery_blocked_v2918(v_user, v_owner) then
    raise exception 'Bu kullanıcıyla etkileşim kuramazsın.';
  end if;

  if v_visibility not in ('everyone', 'public') then
    select exists(
      select 1
      from public.get_my_friendships() f
      where to_jsonb(f)->>'other_user_id' = v_owner::text
        and to_jsonb(f)->>'friendship_status' = 'accepted'
    ) into v_friend;

    if v_mode <> 'friends' or not v_friend then
      raise exception 'Bu Niyet birlikte yapma önerisi kabul etmiyor.';
    end if;
  end if;

  if (
    select count(*)
    from public.personal_intent_collaboration_suggestions
    where requester_user_id = v_user
      and created_at >= current_date
  ) >= 10 then
    raise exception 'Günlük öneri sınırına ulaştın.';
  end if;

  insert into public.personal_intent_collaboration_suggestions(seed_id, owner_user_id, requester_user_id)
  values(p_seed_id, v_owner, v_user)
  returning id into v_id;

  select coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), 'Bir UIN üyesi')
    into v_requester_name
  from public.profiles p
  where p.id = v_user;
  v_requester_name := coalesce(v_requester_name, 'Bir UIN üyesi');

  insert into public.notifications(user_id, notification_type, entity_type, entity_id, title, body, action_url)
  values(
    v_owner,
    'personal_intent_collaboration',
    'personal_intent_collaboration',
    v_id,
    v_requester_name || ' birlikte yapmayı önerdi',
    'Bu Niyeti birlikte gerçekleştirmek istiyor. Kabul etmek veya reddetmek için aç.',
    '/collaboration-suggestions'
  );

  return v_id;
exception
  when unique_violation then
    raise exception 'Bu Niyet için daha önce öneri gönderdin.';
end
$$;
create or replace function public.get_my_personal_intent_collaboration_requests_v30()
returns table(
  id uuid,
  seed_id uuid,
  seed_title text,
  requester_user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    x.id,
    x.seed_id,
    coalesce(nullif(trim(s.title), ''), 'Kişisel Niyet')::text as seed_title,
    x.requester_user_id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.username), ''), 'UIN üyesi')::text as full_name,
    p.username::text,
    p.avatar_url::text,
    x.created_at
  from public.personal_intent_collaboration_suggestions x
  join public.seeds s on s.id = x.seed_id
  left join public.profiles p on p.id = x.requester_user_id
  where x.owner_user_id = auth.uid()
    and x.status = 'pending'
  order by x.created_at desc;
$$;
revoke all on function public.get_my_personal_intent_collaboration_requests_v30() from public, anon;
grant execute on function public.get_my_personal_intent_collaboration_requests_v30() to authenticated;
commit;
