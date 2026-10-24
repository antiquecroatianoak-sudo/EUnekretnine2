CREATE OR REPLACE FUNCTION site_private.draft_number(v jsonb)
 RETURNS real
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select case when jsonb_typeof(v)='number' and (v::text)::numeric between 0 and 1000000000000 then (v::text)::real else null end
$function$;
