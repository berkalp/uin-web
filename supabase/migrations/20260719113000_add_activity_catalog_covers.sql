begin;

alter table public.activity_categories
  add column if not exists default_cover_url text;

alter table public.activities
  add column if not exists default_cover_url text;

comment on column public.activity_categories.default_cover_url is
  'Administrative fallback cover used when an Activity Type has no specific cover.';

comment on column public.activities.default_cover_url is
  'Administrative default cover used by Intent presentation until a Plan selects its own cover.';

create or replace function public.get_admin_activity_catalogue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null
     or not public.is_admin() then
    raise exception
      'Administrator access is required.';
  end if;

  return jsonb_build_object(
    'categories',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',
              category.id,
            'name',
              category.name,
            'default_cover_url',
              category.default_cover_url
          )
          order by category.name
        )
        from public.activity_categories category
      ),
      '[]'::jsonb
    ),

    'activities',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',
              activity.id,
            'name',
              activity.name,
            'category_id',
              category.id,
            'category_name',
              category.name,
            'default_cover_url',
              activity.default_cover_url,
            'category_cover_url',
              category.default_cover_url
          )
          order by
            category.name,
            activity.name
        )
        from public.activities activity
        join public.activity_categories category
          on category.id =
            activity.category_id
      ),
      '[]'::jsonb
    )
  );
end;
$function$;

create or replace function public.admin_update_activity_catalog_cover(
  p_resource_type text,
  p_resource_id uuid,
  p_cover_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_cover_url text;
begin
  if auth.uid() is null
     or not public.is_admin() then
    raise exception
      'Administrator access is required.';
  end if;

  v_cover_url :=
    nullif(
      btrim(
        p_cover_url
      ),
      ''
    );

  if v_cover_url is not null
     and v_cover_url !~* '^https?://'
  then
    raise exception
      'Cover URL must use HTTP or HTTPS.';
  end if;

  if p_resource_type =
     'category'
  then
    update public.activity_categories
    set default_cover_url =
      v_cover_url
    where id =
      p_resource_id;

  elsif p_resource_type =
        'activity'
  then
    update public.activities
    set default_cover_url =
      v_cover_url
    where id =
      p_resource_id;

  else
    raise exception
      'Unsupported catalogue resource type.';
  end if;

  if not found then
    raise exception
      'Catalogue item not found.';
  end if;
end;
$function$;

revoke all on function
  public.get_admin_activity_catalogue()
from public;

revoke all on function
  public.get_admin_activity_catalogue()
from anon;

grant execute on function
  public.get_admin_activity_catalogue()
to authenticated;

revoke all on function
  public.admin_update_activity_catalog_cover(
    text,
    uuid,
    text
  )
from public;

revoke all on function
  public.admin_update_activity_catalog_cover(
    text,
    uuid,
    text
  )
from anon;

grant execute on function
  public.admin_update_activity_catalog_cover(
    text,
    uuid,
    text
  )
to authenticated;

commit;
