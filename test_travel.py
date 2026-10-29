"""Module 6 in Python (travel.py, matching.py): same validation and matching behaviour as travel.mjs/domain.mjs."""
import json
import shutil
import subprocess
import unittest
from datetime import datetime, timezone
from pathlib import Path

import matching
import travel

ROOT = Path(__file__).parent
AIRPORT = dict(name='TEST ONLY zračna luka', lat=45.7429, lon=16.0688, precision='poi')
REQ = dict(destination=AIRPORT, mode='automobil', max_minutes=30, mandatory=True, quote='do 30 minuta vožnje do zračne luke')


class TravelTests(unittest.TestCase):
    def test_validation(self):
        self.assertEqual(travel.validate_travel([REQ]), [REQ])
        for bad in (dict(REQ, destination=dict(AIRPORT, precision='grad')), dict(REQ, mode='zrakoplov'), dict(REQ, max_minutes=0), dict(REQ, quote=''), dict(REQ, mandatory='da')):
            with self.assertRaises(ValueError): travel.validate_travel([bad])

    def test_matching_equals_js(self):
        now = datetime.now(timezone.utc)
        prop = dict(id=7, country='Hrvatska', city='Velika Gorica', title='TEST ONLY', source='https://example.org/p/7', price=1.0, area=600.0, renovation=0.0, other_costs=0.0,
                    property_type='Zemljište', condition='Neizgrađeno', status='Aktivno', source_checked_on=now.date().isoformat(), legal='Uredno', legal_evidence_url='https://example.org/legal')
        def buyer(t):
            return dict(id=3, preferred_countries='Hrvatska', notes='', verified=1, criteria_json=json.dumps(dict(property_types=['Zemljište'], conditions=['Neizgrađeno'],
                        source_url='https://example.org/d/3', checked_at=now.isoformat(), travel=t)))
        mandatory, wish = matching.evaluate(prop, buyer([REQ])), matching.evaluate(prop, buyer([dict(REQ, mandatory=False)]))
        self.assertNotEqual(mandatory['status'], matching.MATCH)
        self.assertEqual(wish['status'], matching.MATCH)
        if shutil.which('node'):
            js = json.loads(subprocess.run(['node', 'test_travel.mjs'], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip().splitlines()[-1])
            self.assertEqual(js[0], mandatory['gaps']['pair'])
            self.assertEqual(js[1], [v for v in wish['info'] if v.startswith('Vrijeme putovanja')])


if __name__ == '__main__':
    unittest.main()
