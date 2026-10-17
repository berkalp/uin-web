-- pg_cron uses GMT here: Saturday 09:00 UTC is Saturday 12:00 Europe/Istanbul.
do $$ begin
  if current_setting('cron.timezone',true) not in ('GMT','UTC') then
    raise exception 'Review cron timezone before enabling the noon campaign';
  end if;
end; $$;
select cron.schedule('uin-weekly-weekend-message','0 9 * * 6',
  $$select uin_private.dispatch_uin_weekend_messages();$$);
