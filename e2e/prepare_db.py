"""Creates an isolated TEST ONLY database for the browser checks (e2e/README.md): the real exported schema and
ops/pair-records.sql via test_pair_records.build_schema, plus a few TEST ONLY records. Never touches another database."""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg
from psycopg.conninfo import conninfo_to_dict, make_conninfo

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from test_pair_records import build_schema  # noqa: E402


def contact(url):
    return json.dumps(dict(mode='direct', name='TEST ONLY', contact_url=url, evidence_url=url, record_reference=url, permitted=True))


def main(name):
    if not name.startswith('e2e_'): raise SystemExit('The browser-check database name must start with e2e_.')
    admin = psycopg.connect(os.environ['TEST_POSTGRES_URL'], autocommit=True)
    admin.execute(f'drop database if exists {name} with (force)')
    admin.execute(f'create database {name}')
    params = conninfo_to_dict(os.environ['TEST_POSTGRES_URL']); params['dbname'] = name
    with psycopg.connect(make_conninfo(**params), autocommit=True) as c:
        with c.cursor() as cur: build_schema(cur)
        c.execute((ROOT / 'ops' / 'pair-records.sql').read_text())
        today, now = datetime.now(timezone.utc).date().isoformat(), datetime.now(timezone.utc).isoformat()
        for n, (title, country, city, ptype) in enumerate([('TEST ONLY zemljište Lukavec', 'Hrvatska', 'Lukavec', 'Zemljište'),
                                                            ('TEST ONLY kuća Split', 'Hrvatska', 'Split', 'Kuća'),
                                                            ('TEST ONLY zemljište Galway', 'Irska', 'Galway', 'Zemljište')], 1):
            url = f'https://example.org/test-only/p/{n}'
            c.execute("""insert into properties(country,city,title,source,price,area,renovation,other_costs,property_type,condition,status,source_checked_on,legal,contact_json)
                         values(%s,%s,%s,%s,%s,%s,0,0,%s,'Neizgrađeno','Aktivno',%s,'Nepoznato',%s)""",
                      (country, city, title, url, 100000 + n * 25000, 600 + n * 100, ptype, today, contact(url)))
        for n, (name_, countries, types) in enumerate([('TEST ONLY kupac zemljišta', 'Hrvatska, Irska', ['Zemljište']), ('TEST ONLY kupac kuće', 'Hrvatska', ['Kuća'])], 1):
            url = f'https://example.org/test-only/d/{n}'
            c.execute("insert into investors(name,country,preferred_countries,notes,verified,criteria_json,contact_json) values(%s,'US',%s,'',1,%s,%s)",
                      (name_, countries, json.dumps(dict(property_types=types, conditions=['Neizgrađeno'], source_url=url, checked_at=now)), contact(url)))
    admin.close()


if __name__ == '__main__':
    main(sys.argv[1])
