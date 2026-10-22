-- NOT APPLIED. Registers the configured public land calls that are not yet in the
-- production registry. Apply only after independent review and a passing read-only
-- probe (.github/workflows/public-land-probe.yml). Idempotent; never updates or
-- deletes an existing source, so earlier checkpoints and manual edits are untouched.
begin;
insert into public.sources(country,name,url,category)
select v.country,v.name,v.url,v.category from (values
 ('IE','Donegal County Council – Expression of Interest: Land and Property for Social Housing',
  'https://donegalcoco.ie/en/services/housing/housing-delivery-and-supply/expressions-of-interest-land-and-property-for-social-housing','Javni kupac zemljišta'),
 ('IE','Kerry County Council – Expression of Interest in Turnkey Units / Land with Development Potential',
  'https://www.kerrycoco.ie/expression-of-interest-in-turnkey-units-land-with-development-potential/','Javni kupac zemljišta')
) as v(country,name,url,category)
where not exists(select 1 from public.sources s where rtrim(s.url,'/')=rtrim(v.url,'/'));
select id,country,url from public.sources where category='Javni kupac zemljišta' order by id;
commit;
