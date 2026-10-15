-- Cron is GMT; 16:00 UTC is 19:00 Europe/Istanbul.
-- Bounded batches drain the eligible queue; each user has a 72-hour cooldown.
select cron.schedule('uin-three-day-digest','0,10,20,30,40,50 16 * * *',
  'select uin_private.dispatch_uin_digests(20);');
