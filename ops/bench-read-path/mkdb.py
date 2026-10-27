# Usage: TEST_POSTGRES_URL=... python ops/bench-read-path/mkdb.py <properties> <candidates> <bytes per run>. Isolated benchmark DB: real exported schema + pair-records.sql, synthetic TEST ONLY volume.
import os,sys,psycopg
from pathlib import Path
R=Path(__file__).resolve().parents[2]; sys.path.insert(0,str(R))
from test_pair_records import build_schema


url=os.environ['TEST_POSTGRES_URL']; name='bench_read'
a=psycopg.connect(url,autocommit=True); a.execute(f'drop database if exists {name} with (force)'); a.execute(f'create database {name}')
c=psycopg.connect(url.replace('/matching_test','/'+name),autocommit=True)
with c.cursor() as cur: build_schema(cur)
c.execute((R/'ops/pair-records.sql').read_text())
P,S,D=int(sys.argv[1]),int(sys.argv[2]),int(sys.argv[3])
c.execute(f"""
insert into properties(country,city,title,source,price,area,renovation,other_costs,property_type,condition,status,source_checked_on,legal,contact_json)
select 'Hrvatska','Grad '||(g%300),'TEST ONLY '||g,'https://example.org/l/'||g,100000+g,500+g%3000,0,0,'Zemljište','Neizgrađeno','Aktivno',current_date,'Nepoznato',
 json_build_object('mode','direct','name','TEST','contact_url','https://example.org/l/'||g,'evidence_url','https://example.org/l/'||g,'record_reference','https://example.org/l/'||g,'permitted',true)::text
from generate_series(1,{P}) g;
insert into investors(name,country,preferred_countries,notes,verified,criteria_json,contact_json)
select 'TEST ONLY kupac '||g,'US','Hrvatska','',1,json_build_object('property_types',json_build_array('Zemljište'),'conditions',json_build_array('Neizgrađeno'),'source_url','https://example.org/d/'||g,'checked_at',now())::text,
 json_build_object('mode','direct','name','TEST','contact_url','https://example.org/d/'||g,'evidence_url','https://example.org/d/'||g,'record_reference','https://example.org/d/'||g,'permitted',true)::text
from generate_series(1,80) g;
insert into source_candidates(id,source_id,kind,title,country,url,body_json,last_seen,property_id)
select 'c'||g,'registry-'||(g%150),case when g%20=0 then 'buyer' else 'property' end,'TEST ONLY '||g,'HR','https://example.org/c/'||g,
 json_build_object('facts',json_build_object('asking_price',100000,'listing_active',true,'description',repeat('opis ',300)))::text,(now()-(g%1000)*interval '1 minute')::text,
 case when g<={P} then g else null end
from generate_series(1,{S}) g;
insert into site_private.listing_lifecycle(candidate_id,state) select 'c'||g,case when g%50=0 then 'expired' else 'observed' end from generate_series(1,{S}) g on conflict do nothing;
insert into discovery_runs(source_id,status,checked_at,body_json) select 'run-'||g,'ok',now()::text,repeat('x',{D}) from generate_series(1,2000) g;
analyze;
""")
print('db ready',P,S,D)
