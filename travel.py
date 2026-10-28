"""Travel-time contract (module 6), mirrors validateTravel in supabase/functions/sites-platform/travel.mjs. The module is
off: no approved routing service without new cost or account, so nothing is ever computed here."""
import math
import re

TRAVEL_REASON = 'Nema odobrenog servisa za rute bez novih troškova ili računa; modul je isključen.'
MODES = ('automobil', 'javni prijevoz', 'pješice')
PRECISE = ('poi', 'adresa')


def _text(v, limit):
    return isinstance(v, str) and v.strip() != '' and len(v) <= limit and not re.search(r'[\x00-\x1f]', v)


def _coord(lat, lon):
    return all(isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) for x in (lat, lon)) and abs(lat) <= 90 and abs(lon) <= 180


def validate_travel(items):
    if not isinstance(items, list) or len(items) > 10: raise ValueError('Uvjeti putovanja moraju biti popis (najviše 10).')
    for n, t in enumerate(items):
        where, d = 'Uvjet putovanja ' + str(n + 1), (t or {}).get('destination') if isinstance(t, dict) else None
        if not isinstance(d, dict) or not _text(d.get('name'), 200) or not _coord(d.get('lat'), d.get('lon')) or d.get('precision') not in PRECISE:
            raise ValueError(where + ': odredište mora biti točna lokacija (POI ili adresa) s koordinatama.')
        if t.get('mode') not in MODES: raise ValueError(where + ': nepoznat način putovanja.')
        m = t.get('max_minutes')
        if not isinstance(m, int) or isinstance(m, bool) or m < 1 or m > 600: raise ValueError(where + ': najveće vrijeme mora biti 1–600 minuta.')
        if not isinstance(t.get('mandatory'), bool) or not _text(t.get('quote'), 500): raise ValueError(where + ': potrebni su obaveznost i izvorni navod.')
        if t.get('traffic') is not None and not _text(t['traffic'], 200): raise ValueError(where + ': neispravna pretpostavka prometa.')
    return items
