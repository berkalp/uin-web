begin;
set local role anon;
set local statement_timeout='3s';
do $test$
declare rows jsonb; super_count integer; premier_count integer;
begin
 rows:=public.get_club_directory_v181();
 select count(*)filter(where r->>'league'='Trendyol Süper Lig' and lower(r->>'sport')='futbol' and lower(r->>'division')='erkek'),count(*)filter(where r->>'league'='Premier League') into super_count,premier_count from jsonb_array_elements(rows)r;
 if super_count<>18 or premier_count<>20 then raise exception 'Club directory incomplete: % / %',super_count,premier_count;end if;
 if exists(select 1 from jsonb_array_elements(rows)r where r ? 'wanting' or r ? 'done' or r ? 'active' or nullif(r->>'catalogItemId','') is null) then raise exception 'Invalid metadata contract';end if;
end;
$test$;
rollback;
