"""Applies ops/pair-records.sql to a throwaway database built from the real exported schema."""
import json
import os
import shutil
import subprocess
import unittest
import uuid
from pathlib import Path

ROOT = Path(__file__).parent
SCHEMA = json.loads((ROOT / 'ops' / 'pair-review-schema-2026-10-22.json').read_text())
def build_schema(cur):
    cur.execute('create schema site_private')
    tables = {}
    for c in sorted(SCHEMA['columns'], key=lambda c: (c['table_schema'], c['table_name'], c['ordinal_position'])):
        tables.setdefault((c['table_schema'], c['table_name']), []).append(c)
    for (schema, table), cols in tables.items():
        parts = []
        for c in cols:
            default = c['column_default']
            if default and default.startswith('nextval('):
                cur.execute(f"create sequence if not exists {schema}.{default.split(chr(39))[1]}")
            parts.append(f'"{c["column_name"]}" {c["data_type"]}' + (' not null' if c['is_nullable'] == 'NO' else '') + (f' default {default}' if default else ''))
        cur.execute(f'create table {schema}.{table} ({", ".join(parts)})')
    for c in sorted(SCHEMA['constraints'], key=lambda c: 'FOREIGN' in c['definition']):
        table = c['table_name'] if '.' in c['table_name'] else 'public.' + c['table_name']
        cur.execute(f'alter table {table} add constraint {c["conname"]} {c["definition"].replace("REFERENCES match_results", "REFERENCES public.match_results")}')
    for f in SCHEMA['functions']:
        cur.execute(f['definition'])
    for t in SCHEMA['triggers']:
        cur.execute(t['definition'])
    for r in SCHEMA['rls']:
        if r['rowsecurity']:
            cur.execute(f'alter table {r["schemaname"]}.{r["tablename"]} enable row level security')
    cur.execute('alter table properties add column if not exists contact_json text')
    cur.execute('alter table investors add column if not exists contact_json text')
    # Not part of the pair-review export but read by sites-platform `read`: minimal test-only shapes,
    # columns as in storage.SCHEMA. They hold no production structure beyond what the app already reads.
    cur.execute('create table public.sources(id bigserial primary key,country text,name text,url text,category text,is_active boolean not null default true,inactive_reason text)')
    cur.execute('create table public.discovery_runs(source_id text primary key,status text not null,checked_at text not null,body_json text not null)')
    cur.execute('create table public.imports(id bigserial primary key,source_url text unique not null,checked_at text not null,evidence_url text not null,property_id integer not null)')

@unittest.skipUnless(os.environ.get('TEST_POSTGRES_URL'), 'TEST_POSTGRES_URL nije postavljen')
class PairRecordsMigrationTests(unittest.TestCase):
    def setUp(self):
        import psycopg
        from psycopg.conninfo import conninfo_to_dict, make_conninfo
        self.name = 'pair_records_' + uuid.uuid4().hex
        self.admin = psycopg.connect(os.environ['TEST_POSTGRES_URL'], autocommit=True)
        self.admin.execute(f'create database {self.name}')
        params = conninfo_to_dict(os.environ['TEST_POSTGRES_URL']); params['dbname'] = self.name
        self.c = psycopg.connect(make_conninfo(**params), autocommit=True)
        with self.c.cursor() as cur: build_schema(cur)
    def tearDown(self):
        self.c.close()
        self.admin.execute(f'drop database {self.name} with (force)')
        self.admin.close()
    def run_file(self, name):
        self.c.execute((ROOT / 'ops' / name).read_text())
    def test_regressions_and_repeatable_apply(self):
        self.run_file('pair-records.sql')
        self.run_file('test-pair-records.sql')
        self.run_file('test-verification-policy.sql')
        # Re-applying keeps existing records and does not duplicate the initial history.
        self.c.execute("insert into site_private.pair_records(property_id,investor_id,status,result_json) values(1,2,'Kandidat - potrebna provjera','{}')")
        self.c.execute("insert into site_private.pair_answers(property_id,investor_id,requirement,kind,body,status,recorded_by) values(1,2,'Izvor oglasa','Nacrt pitanja','Pitanje','Nacrt','test')")
        self.run_file('pair-records.sql'); self.run_file('pair-records.sql')
        self.assertEqual(self.c.execute('select count(*) from site_private.pair_records').fetchone()[0], 1)
        self.assertEqual(self.c.execute('select count(*) from site_private.pair_history').fetchone()[0], 1)
        self.assertEqual(self.c.execute('select count(*) from site_private.pair_answers').fetchone()[0], 1)
        self.assertEqual(self.c.execute("select count(*) from pg_class where relname like 'pair_%' and relrowsecurity").fetchone()[0], 5)
    def run_node(self, script):
        self.run_file('pair-records.sql')
        from psycopg.conninfo import conninfo_to_dict
        params = conninfo_to_dict(os.environ['TEST_POSTGRES_URL']); params['dbname'] = self.name
        url = 'postgres://{user}:{password}@{host}:{port}/{dbname}'.format(user=params.get('user', 'postgres'), password=params.get('password', ''),
            host=params.get('host', 'localhost'), port=params.get('port', 5432), dbname=self.name)
        if params.get('sslmode'): url += '?sslmode=' + params['sslmode']
        done = subprocess.run(['node', str(ROOT / script)], env=dict(os.environ, PAIR_DB_URL=url), capture_output=True, text=True, timeout=120)
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
    @unittest.skipUnless(os.environ.get('PG_MODULE') and shutil.which('node'), 'PG_MODULE (postgres@3.4.7) ili node nisu dostupni')
    def test_pair_api_against_migrated_schema(self):
        self.run_node('test_pair_api.mjs')
    @unittest.skipUnless(os.environ.get('PG_MODULE') and shutil.which('node'), 'PG_MODULE (postgres@3.4.7) ili node nisu dostupni')
    def test_read_path_against_migrated_schema(self):
        self.run_node('test_read_staged.mjs')
    @unittest.skipUnless(os.environ.get('PG_MODULE') and shutil.which('node'), 'PG_MODULE (postgres@3.4.7) ili node nisu dostupni')
    def test_refresh_equivalence_against_migrated_schema(self):
        self.run_node('test_refresh_equivalence.mjs')

if __name__ == '__main__':
    unittest.main()

