"""Shared SQL storage; SQLite locally, Supabase PostgreSQL when configured."""
import os
import sqlite3
from pathlib import Path

SCHEMA = '''
CREATE TABLE IF NOT EXISTS properties(id INTEGER PRIMARY KEY,country TEXT,city TEXT,title TEXT,price REAL,area REAL,source TEXT,legal TEXT DEFAULT 'Nepoznato',status TEXT DEFAULT 'Novo',renovation REAL DEFAULT 0,other_costs REAL DEFAULT 0,estimated_value REAL,updated TEXT);
CREATE TABLE IF NOT EXISTS investors(id INTEGER PRIMARY KEY,name TEXT,country TEXT,min_budget REAL,max_budget REAL,preferred_countries TEXT,notes TEXT,verified INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS sources(id INTEGER PRIMARY KEY,country TEXT,name TEXT,url TEXT,category TEXT);
CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY,property_id INTEGER,investor_id INTEGER,stage TEXT,notes TEXT,date TEXT);
CREATE TABLE IF NOT EXISTS imports(id INTEGER PRIMARY KEY,source_url TEXT UNIQUE NOT NULL,checked_at TEXT NOT NULL,evidence_url TEXT NOT NULL,property_id INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS notification_outbox(id INTEGER PRIMARY KEY,property_id INTEGER NOT NULL,created_at TEXT NOT NULL,status TEXT DEFAULT 'Spremno',message TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS source_candidates(id TEXT PRIMARY KEY,source_id TEXT NOT NULL,kind TEXT NOT NULL,title TEXT NOT NULL,country TEXT NOT NULL,url TEXT NOT NULL,body_json TEXT NOT NULL,last_seen TEXT NOT NULL,property_id INTEGER,investor_id INTEGER);
CREATE TABLE IF NOT EXISTS discovery_runs(source_id TEXT PRIMARY KEY,status TEXT NOT NULL,checked_at TEXT NOT NULL,body_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS match_results(property_id INTEGER NOT NULL,investor_id INTEGER NOT NULL,result_json TEXT NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(property_id,investor_id));
'''

# Additive migration: old rows keep unknown criteria rather than invented values.
EXTRA_COLUMNS = {
    'properties': {'property_type': 'TEXT', 'condition': 'TEXT', 'region': 'TEXT',
                   'buildable': 'TEXT', 'planning_evidence_url': 'TEXT',
                   'legal_evidence_url': 'TEXT', 'valuation_evidence_url': 'TEXT', 'available_until': 'TEXT',
                   # Date of an explicit, evidenced check of the source listing; never set by an ordinary save.
                   'source_checked_on': 'TEXT', 'activity_evidence': 'TEXT'},
    'investors': {'criteria_json': "TEXT DEFAULT '{}'"},
}

def upgrade(c, postgres):
    for table, columns in EXTRA_COLUMNS.items():
        existing = ({r['column_name'] for r in c.execute(
            'SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=?', (table,))}
            if postgres else {r['name'] for r in c.execute('PRAGMA table_info(' + table + ')')})
        for name, definition in columns.items():
            if postgres and name not in existing:
                c.execute(f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {name} {definition}')
            elif not postgres and name not in existing:
                c.execute(f'ALTER TABLE {table} ADD COLUMN {name} {definition}')

class Postgres:
    def __init__(self, url):
        import psycopg
        from psycopg.rows import dict_row
        self.raw = psycopg.connect(url, row_factory=dict_row, sslmode='require')
    def execute(self, sql, params=()):
        return self.raw.execute(sql.replace('?', '%s'), params)
    def executemany(self, sql, rows):
        with self.raw.cursor() as cursor:
            cursor.executemany(sql.replace('?', '%s'), rows)
    def commit(self): self.raw.commit()
    def rollback(self): self.raw.rollback()
    def close(self): self.raw.close()

def connect(url=None, path=None):
    url = url or os.environ.get('DATABASE_URL')
    if url:
        c = Postgres(url)
        for statement in SCHEMA.replace('id INTEGER PRIMARY KEY', 'id BIGSERIAL PRIMARY KEY').split(';'):
            if statement.strip(): c.execute(statement)
    else:
        c = sqlite3.connect(path or str(Path(__file__).with_name('eu_platform.db')))
        c.row_factory = sqlite3.Row
        c.executescript(SCHEMA)
    upgrade(c, bool(url))
    if url:
        # Results contain private mandates; keep the new table off public Data API access.
        for table in ('match_results','source_candidates','discovery_runs'):
            security = c.execute('SELECT relrowsecurity FROM pg_class WHERE oid=?::regclass',(table,)).fetchone()
            if not security['relrowsecurity']:
                c.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')
    c.commit()
    return c


