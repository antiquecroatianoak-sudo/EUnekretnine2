"""Match-quality reference set (ops/match-quality-reference-v1.json) through matching.py, compared with the expected
outcome and with domain.mjs (test_match_quality.mjs) where both evaluators support the same contract."""
import json
import re
import shutil
import subprocess
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import matching

ROOT = Path(__file__).parent
REF = json.loads((ROOT / 'ops' / 'match-quality-reference-v1.json').read_text())
OUTCOME = {matching.MATCH: 'odgovara', matching.REJECT: 'odstupa', matching.CANDIDATE: 'nedovoljno'}


def fill(v, now):
    if isinstance(v, str) and (m := re.fullmatch(r'@(day|stamp):(-?\d+)', v)):
        t = now + timedelta(days=int(m[2]))
        return t.date().isoformat() if m[1] == 'day' else t.isoformat().replace('+00:00', 'Z')
    if isinstance(v, list): return [fill(x, now) for x in v]
    if isinstance(v, dict): return {k: fill(x, now) for k, x in v.items()}
    return v


def build(case, now):
    c = fill(case, now)
    prop = dict(id=1, country='Hrvatska', city='Zagreb', title='TEST ONLY', source='https://example.org/test-only/q/listing', price=200000.0, area=1000.0,
                renovation=0.0, other_costs=0.0, property_type='Zemljište', condition='Neizgrađeno', status='Aktivno', source_checked_on=now.date().isoformat(),
                legal='Uredno', legal_evidence_url='https://example.org/test-only/q/legal')
    prop.update({k: v for k, v in (c.get('property') or {}).items() if k != 'contact_ref'})
    if 'facts' in c: prop['facts_json'] = json.dumps(c['facts'], ensure_ascii=False)
    criteria = dict(property_types=['Zemljište'], conditions=['Neizgrađeno'], source_url='https://example.org/test-only/q/demand', checked_at=now.isoformat().replace('+00:00', 'Z'))
    criteria.update(c.get('criteria') or {})
    investor = dict(id=9, name='TEST ONLY kupac', country='US', preferred_countries='Hrvatska', notes='', verified=1)
    investor.update(c.get('buyer') or {})
    investor['criteria_json'] = json.dumps(criteria, ensure_ascii=False)
    return prop, investor


class MatchQualityReferenceTests(unittest.TestCase):
    def evaluate_all(self):
        now = datetime.now(timezone.utc)
        out = {}
        for case in REF['cases']:
            if not case['parity']: continue
            r = matching.evaluate(*build(case, now))
            actual = OUTCOME[r['status']]
            where = r['reasons'] if actual == 'odgovara' else r['rejected'] if actual == 'odstupa' else r['missing']
            out[case['id']] = (actual, any(v.startswith(case['label']) for v in where) and not set(case.get('not_rejected', [])) & set(r['rejected']))
        return out

    def test_expected_outcomes_and_reasons(self):
        for case in REF['cases']:
            if not case['parity'] or case['contract'] != 'podržano': continue
            actual, reason = self.evaluate_all()[case['id']]
            with self.subTest(case=case['id']):
                self.assertEqual(actual, case['expected'], case['title'])
                self.assertTrue(reason, case['label'])

    def test_same_outcome_as_js(self):
        if not shutil.which('node'): self.skipTest('node nije dostupan')
        js = json.loads(subprocess.run(['node', 'test_match_quality.mjs'], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip().splitlines()[-1])
        py = self.evaluate_all()
        self.assertGreaterEqual(len(py), 20)
        self.assertEqual({k: v[0] for k, v in py.items()}, {k: js[k] for k in py})


if __name__ == '__main__':
    unittest.main()
