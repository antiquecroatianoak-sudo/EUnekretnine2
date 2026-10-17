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
'''

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
    c.commit()
    return c
