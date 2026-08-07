begin;

-- Adds a second, independent dimension to Plan Needs:
--   shared          = participants collectively cover one total quantity
--   per_participant = every active participant confirms the per-person quantity
-- Existing Needs remain "shared".

alter table public.plan_needs
add column if not exists fulfillment_mode text not null default 'shared';

do $constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where
      conname = 'plan_needs_fulfillment_mode_check'
      and conrelid = 'public.plan_needs'::regclass
  ) then
    alter table public.plan_needs
    add constraint plan_needs_fulfillment_mode_check
    check (
      fulfillment_mode in (
        'shared',
        'per_participant'
      )
    );
  end if;
end;
$constraint$;

create index if not exists plan_needs_plan_mode_idx
on public.plan_needs (
  plan_id,
  fulfillment_mode,
  importance,
  created_at,
  id
);


create or replace function public.get_plan_active_participant_count(
  p_plan_id uuid
)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select count(*)::integer
  from (
    select plan.host_user_id as user_id
    from public.plans plan
    where
      plan.id = p_plan_id
      and plan.host_user_id is not null

    union

    select member.user_id
    from public.plan_members member
    where
      member.plan_id = p_plan_id
      and member.status = 'active'
  ) active_participant;
$function$;

revoke all
on function public.get_plan_active_participant_count(uuid)
from public, anon, authenticated;


-- The return shape changed, therefore PostgreSQL requires a drop/recreate.
drop function if exists public.get_plan_needs(uuid);

create function public.get_plan_needs(
  p_plan_id uuid
)
returns table (
  need_id uuid,
  plan_id uuid,
  need text,
  quantity integer,
  importance text,
  fulfillment_mode text,
  contributed_quantity integer,
  remaining_quantity integer,
  contributor_count integer,
  active_participant_count integer,
  remaining_participant_count integer,
  is_fulfilled boolean,
  viewer_quantity integer,
  can_manage boolean,
  contributors jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.can_view_plan_needs(
    p_plan_id
  ) then
    raise exception
      'You are not allowed to view this Plan.'
      using errcode = '42501';
  end if;

  return query
  select
    need_row.id,
    need_row.plan_id,
    need_row.need,
    need_row.quantity,
    need_row.importance,
    need_row.fulfillment_mode,
    aggregate_row.contributed_quantity,
    case
      when need_row.fulfillment_mode = 'per_participant'
        then greatest(
          (
            participant_row.active_participant_count -
            aggregate_row.contributor_count
          ) * need_row.quantity,
          0
        )::integer
      else greatest(
        need_row.quantity -
          aggregate_row.contributed_quantity,
        0
      )::integer
    end as remaining_quantity,
    aggregate_row.contributor_count,
    participant_row.active_participant_count,
    greatest(
      participant_row.active_participant_count -
        aggregate_row.contributor_count,
      0
    )::integer as remaining_participant_count,
    case
      when need_row.fulfillment_mode = 'shared'
        then (
          aggregate_row.contributed_quantity >=
            need_row.quantity
        )
      when need_row.importance = 'required'
        then (
          participant_row.active_participant_count > 0
          and aggregate_row.contributor_count >=
            participant_row.active_participant_count
        )
      else false
    end::boolean as is_fulfilled,
    coalesce(
      viewer_row.quantity,
      0
    )::integer,
    public.can_manage_plan_needs(
      need_row.plan_id
    )::boolean,
    coalesce(
      contributor_row.contributors,
      '[]'::jsonb
    ),
    need_row.created_at,
    need_row.updated_at
  from public.plan_needs need_row

  left join lateral (
    select
      coalesce(
        sum(contribution.quantity),
        0
      )::integer
        as contributed_quantity,
      count(*)::integer
        as contributor_count
    from public.plan_need_contributions contribution
    where contribution.need_id = need_row.id
  ) aggregate_row
    on true

  left join lateral (
    select public.get_plan_active_participant_count(
      need_row.plan_id
    )::integer as active_participant_count
  ) participant_row
    on true

  left join lateral (
    select contribution.quantity
    from public.plan_need_contributions contribution
    where
      contribution.need_id = need_row.id
      and contribution.user_id = v_user_id
    limit 1
  ) viewer_row
    on true

  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'user_id', contribution.user_id,
        'full_name', profile.full_name,
        'username', profile.username,
        'avatar_url', profile.avatar_url,
        'quantity', contribution.quantity
      )
      order by
        coalesce(
          profile.full_name,
          profile.username,
          'UIN member'
        ),
        contribution.created_at,
        contribution.user_id
    ) as contributors
    from public.plan_need_contributions contribution
    left join public.profiles profile
      on profile.id = contribution.user_id
    where contribution.need_id = need_row.id
  ) contributor_row
    on true

  where need_row.plan_id = p_plan_id
  order by
    case
      when need_row.importance = 'required'
        then 0
      else 1
    end,
    need_row.created_at,
    need_row.id;
end;
$function$;

revoke all
on function public.get_plan_needs(uuid)
from public, anon;

grant execute
on function public.get_plan_needs(uuid)
to authenticated;


-- Replace the four-argument RPC with a five-argument version. The final
-- argument has a default, so older clients still create shared Needs.
drop function if exists public.create_plan_need(uuid, text, integer, text);
drop function if exists public.create_plan_need(uuid, text, integer, text, text);

create function public.create_plan_need(
  p_plan_id uuid,
  p_need text,
  p_quantity integer default null,
  p_importance text default 'required',
  p_fulfillment_mode text default 'shared'
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_need text;
  v_quantity integer;
  v_importance text;
  v_fulfillment_mode text;
  v_need_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  perform public.assert_user_not_restricted(
    v_user_id,
    'account_access'
  );

  v_need := btrim(
    coalesce(p_need, '')
  );

  v_quantity := coalesce(
    p_quantity,
    1
  );

  v_importance := lower(
    btrim(
      coalesce(
        p_importance,
        'required'
      )
    )
  );

  v_fulfillment_mode := lower(
    btrim(
      coalesce(
        p_fulfillment_mode,
        'shared'
      )
    )
  );

  if char_length(v_need) not between 1 and 160 then
    raise exception
      'Need must be between 1 and 160 characters.'
      using errcode = '22023';
  end if;

  if v_quantity not between 1 and 100000 then
    raise exception
      'Quantity must be a whole number between 1 and 100000.'
      using errcode = '22023';
  end if;

  if v_importance not in ('required', 'optional') then
    raise exception
      'Need importance must be Required or Optional.'
      using errcode = '22023';
  end if;

  if v_fulfillment_mode not in ('shared', 'per_participant') then
    raise exception
      'Need fulfillment type must be Shared or Everyone.'
      using errcode = '22023';
  end if;

  perform public.lock_plan_need_manager(
    p_plan_id
  );

  if not public.is_plan_needs_editable(
    p_plan_id
  ) then
    raise exception
      'Plan needs can only be changed while the Plan is active.'
      using errcode = '55000';
  end if;

  insert into public.plan_needs (
    plan_id,
    need,
    quantity,
    importance,
    fulfillment_mode,
    created_by
  )
  values (
    p_plan_id,
    v_need,
    v_quantity,
    v_importance,
    v_fulfillment_mode,
    v_user_id
  )
  returning id
  into v_need_id;

  return v_need_id;
end;
$function$;

revoke all
on function public.create_plan_need(uuid, text, integer, text, text)
from public, anon;

grant execute
on function public.create_plan_need(uuid, text, integer, text, text)
to authenticated;


-- Quantity and fulfillment mode are structural. Once somebody contributes,
-- neither may change. The Need name and Required/Optional flag remain editable.
drop function if exists public.update_plan_need(uuid, text, integer, text);
drop function if exists public.update_plan_need(uuid, text, integer, text, text);

create function public.update_plan_need(
  p_need_id uuid,
  p_need text,
  p_quantity integer default null,
  p_importance text default 'required',
  p_fulfillment_mode text default 'shared'
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_plan_id uuid;
  v_current_quantity integer;
  v_current_fulfillment_mode text;
  v_need text;
  v_quantity integer;
  v_importance text;
  v_fulfillment_mode text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  perform public.assert_user_not_restricted(
    v_user_id,
    'account_access'
  );

  select need_row.plan_id
  into v_plan_id
  from public.plan_needs need_row
  where need_row.id = p_need_id;

  if v_plan_id is null then
    raise exception
      'Need not found.'
      using errcode = 'P0002';
  end if;

  perform public.lock_plan_need_manager(
    v_plan_id
  );

  select
    need_row.quantity,
    need_row.fulfillment_mode
  into
    v_current_quantity,
    v_current_fulfillment_mode
  from public.plan_needs need_row
  where
    need_row.id = p_need_id
    and need_row.plan_id = v_plan_id
  for update;

  if not found then
    raise exception
      'Need not found.'
      using errcode = 'P0002';
  end if;

  if not public.is_plan_needs_editable(
    v_plan_id
  ) then
    raise exception
      'Plan needs can only be changed while the Plan is active.'
      using errcode = '55000';
  end if;

  v_need := btrim(
    coalesce(p_need, '')
  );

  v_quantity := coalesce(
    p_quantity,
    1
  );

  v_importance := lower(
    btrim(
      coalesce(
        p_importance,
        'required'
      )
    )
  );

  v_fulfillment_mode := lower(
    btrim(
      coalesce(
        p_fulfillment_mode,
        'shared'
      )
    )
  );

  if char_length(v_need) not between 1 and 160 then
    raise exception
      'Need must be between 1 and 160 characters.'
      using errcode = '22023';
  end if;

  if v_quantity not between 1 and 100000 then
    raise exception
      'Quantity must be a whole number between 1 and 100000.'
      using errcode = '22023';
  end if;

  if v_importance not in ('required', 'optional') then
    raise exception
      'Need importance must be Required or Optional.'
      using errcode = '22023';
  end if;

  if v_fulfillment_mode not in ('shared', 'per_participant') then
    raise exception
      'Need fulfillment type must be Shared or Everyone.'
      using errcode = '22023';
  end if;

  if
    (
      v_quantity <> v_current_quantity
      or v_fulfillment_mode <>
        v_current_fulfillment_mode
    )
    and exists (
      select 1
      from public.plan_need_contributions contribution
      where contribution.need_id = p_need_id
    )
  then
    raise exception
      'Quantity and fulfillment type cannot be changed after contributions begin.'
      using errcode = '55000';
  end if;

  update public.plan_needs
  set
    need = v_need,
    quantity = v_quantity,
    importance = v_importance,
    fulfillment_mode = v_fulfillment_mode
  where id = p_need_id;
end;
$function$;

revoke all
on function public.update_plan_need(uuid, text, integer, text, text)
from public, anon;

grant execute
on function public.update_plan_need(uuid, text, integer, text, text)
to authenticated;


-- Shared Needs retain the aggregate quantity rules. Per-participant Needs
-- ignore the client quantity and always record the configured per-person amount.
create or replace function public.set_my_plan_need_contribution(
  p_need_id uuid,
  p_quantity integer default 1
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_plan_id uuid;
  v_target_quantity integer;
  v_fulfillment_mode text;
  v_contribution_quantity integer;
  v_other_quantity integer;
  v_remaining_quantity integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  perform public.assert_user_not_restricted(
    v_user_id,
    'account_access'
  );

  select need_row.plan_id
  into v_plan_id
  from public.plan_needs need_row
  where need_row.id = p_need_id;

  if v_plan_id is null then
    raise exception
      'Need not found.'
      using errcode = 'P0002';
  end if;

  perform public.lock_plan_need_member(
    v_plan_id
  );

  select
    need_row.quantity,
    need_row.fulfillment_mode
  into
    v_target_quantity,
    v_fulfillment_mode
  from public.plan_needs need_row
  where
    need_row.id = p_need_id
    and need_row.plan_id = v_plan_id
  for update;

  if not found then
    raise exception
      'Need not found.'
      using errcode = 'P0002';
  end if;

  if not public.is_plan_needs_editable(
    v_plan_id
  ) then
    raise exception
      'Your contribution cannot be changed in the current Plan state.'
      using errcode = '55000';
  end if;

  if v_fulfillment_mode = 'per_participant' then
    v_contribution_quantity := v_target_quantity;
  else
    if
      p_quantity is null
      or p_quantity not between 1 and 100000
    then
      raise exception
        'Contribution quantity must be a whole number between 1 and 100000.'
        using errcode = '22023';
    end if;

    v_contribution_quantity := p_quantity;

    select coalesce(
      sum(contribution.quantity),
      0
    )::integer
    into v_other_quantity
    from public.plan_need_contributions contribution
    where
      contribution.need_id = p_need_id
      and contribution.user_id <> v_user_id;

    v_remaining_quantity := greatest(
      v_target_quantity -
        v_other_quantity,
      0
    );

    if v_contribution_quantity > v_remaining_quantity then
      raise exception
        'Only % item(s) remain.',
        v_remaining_quantity
        using errcode = '22023';
    end if;
  end if;

  insert into public.plan_need_contributions (
    need_id,
    user_id,
    quantity
  )
  values (
    p_need_id,
    v_user_id,
    v_contribution_quantity
  )
  on conflict (
    need_id,
    user_id
  )
  do update
  set
    quantity = excluded.quantity,
    updated_at = now();
end;
$function$;

revoke all
on function public.set_my_plan_need_contribution(uuid, integer)
from public, anon;

grant execute
on function public.set_my_plan_need_contribution(uuid, integer)
to authenticated;


-- Register only the new copy. Existing manually-entered translations are not
-- overwritten because the upsert updates blank Turkish values only.
do $language_seed$
begin
  if
    to_regclass('public.translation_keys') is not null
    and to_regclass('public.translation_values') is not null
    and to_regclass('public.app_locales') is not null
  then
    insert into public.translation_keys (
      key,
      namespace,
      default_text,
      description,
      source_revision,
      is_active
    )
    select
      source_row.key,
      'plan-needs',
      source_row.default_text,
      'Plan Needs fulfillment mode',
      1,
      true
    from (
      values
        ('source.plan-needs.who-should-bring', 'Who should bring it?'),
        ('source.plan-needs.shared-need', 'Shared need'),
        ('source.plan-needs.every-participant', 'Every participant'),
        ('source.plan-needs.shared-description', 'One or more participants can cover the total quantity.'),
        ('source.plan-needs.every-participant-description', 'Each active participant confirms this separately.'),
        ('source.plan-needs.total-quantity', 'Total quantity'),
        ('source.plan-needs.per-person-quantity', 'Per-person quantity'),
        ('source.plan-needs.shared', 'Shared'),
        ('source.plan-needs.people-progress', '{1} / {2} people'),
        ('source.plan-needs.each-participant-brings', 'Each participant brings {1}'),
        ('source.plan-needs.everyone-ready', 'Everyone is ready'),
        ('source.plan-needs.one-person-confirm', '1 person still needs to confirm'),
        ('source.plan-needs.people-confirm', '{1} people still need to confirm'),
        ('source.plan-needs.one-person-bringing', '1 person will bring this'),
        ('source.plan-needs.people-bringing', '{1} people will bring this'),
        ('source.plan-needs.you-will-bring', 'You’ll bring {1}'),
        ('source.plan-needs.structure-locked', 'Quantity and fulfillment type cannot be changed after contributions begin.'),
        ('source.plan-needs.fulfillment-validation', 'Need fulfillment type must be Shared or Everyone.')
    ) as source_row(
      key,
      default_text
    )
    on conflict (key)
    do update
    set
      namespace = excluded.namespace,
      description = excluded.description,
      source_revision =
        case
          when public.translation_keys.default_text
            is distinct from excluded.default_text
            then public.translation_keys.source_revision + 1
          else public.translation_keys.source_revision
        end,
      default_text = excluded.default_text,
      is_active = true,
      updated_at = now();

    insert into public.translation_values (
      translation_key_id,
      locale_code,
      value,
      source_revision,
      updated_by
    )
    select
      translation_key.id,
      'tr',
      translation_row.translated_text,
      translation_key.source_revision,
      null
    from (
      values
        ('Who should bring it?', 'Kim getirecek?'),
        ('Shared need', 'Ortak ihtiyaç'),
        ('Every participant', 'Her katılımcı'),
        ('One or more participants can cover the total quantity.', 'Toplam miktarı bir veya birden fazla katılımcı karşılayabilir.'),
        ('Each active participant confirms this separately.', 'Her aktif katılımcı bunu ayrı ayrı onaylar.'),
        ('Total quantity', 'Toplam adet'),
        ('Per-person quantity', 'Kişi başı adet'),
        ('Shared', 'Ortak'),
        ('{1} / {2} people', '{1} / {2} kişi'),
        ('Each participant brings {1}', 'Her katılımcı {1} adet getirir'),
        ('Everyone is ready', 'Herkes hazır'),
        ('1 person still needs to confirm', '1 kişinin daha onayı bekleniyor'),
        ('{1} people still need to confirm', '{1} kişinin daha onayı bekleniyor'),
        ('1 person will bring this', '1 kişi getirecek'),
        ('{1} people will bring this', '{1} kişi getirecek'),
        ('You’ll bring {1}', '{1} adet getireceksin'),
        ('Quantity and fulfillment type cannot be changed after contributions begin.', 'Katkı başladıktan sonra adet ve karşılama biçimi değiştirilemez.'),
        ('Need fulfillment type must be Shared or Everyone.', 'Karşılama biçimi Ortak İhtiyaç veya Her Katılımcı olmalıdır.')
    ) as translation_row(
      default_text,
      translated_text
    )
    join public.translation_keys translation_key
      on translation_key.default_text = translation_row.default_text
    where exists (
      select 1
      from public.app_locales locale
      where locale.code = 'tr'
    )
    on conflict (
      translation_key_id,
      locale_code
    )
    do update
    set
      value = excluded.value,
      source_revision = excluded.source_revision,
      updated_by = excluded.updated_by,
      updated_at = now()
    where nullif(
      btrim(
        public.translation_values.value
      ),
      ''
    ) is null;
  end if;
end;
$language_seed$;

commit;

notify pgrst, 'reload schema';

select
  exists (
    select 1
    from information_schema.columns
    where
      table_schema = 'public'
      and table_name = 'plan_needs'
      and column_name = 'fulfillment_mode'
  ) as fulfillment_mode_ready,
  to_regprocedure(
    'public.get_plan_needs(uuid)'
  ) is not null as get_plan_needs_ready,
  to_regprocedure(
    'public.create_plan_need(uuid,text,integer,text,text)'
  ) is not null as create_plan_need_ready,
  to_regprocedure(
    'public.update_plan_need(uuid,text,integer,text,text)'
  ) is not null as update_plan_need_ready;
