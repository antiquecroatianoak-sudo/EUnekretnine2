"""facts-v1 in Python (facts.py, matching.py) against the shared vectors and the JS implementation."""
import json
import shutil
import subprocess
import unittest
from datetime import datetime, timezone
from pathlib import Path

import facts
import matching

ROOT = Path(__file__).parent
VECTORS = json.loads((ROOT / 'ops' / 'facts-vectors-v1.json').read_text())


def fact(value, unit=None, status='potvrđeno', day=None):
    out = dict(value=value, origin='izvor', status=status, observed_on=day or datetime.now(timezone.utc).date().isoformat())
    if unit: out['unit'] = unit
    if status == 'potvrđeno': out['evidence'] = 'TEST ONLY oglas'
    return out


class FactsTests(unittest.TestCase):
    def test_vectors(self):
        self.assertEqual(VECTORS['version'], facts.FACTS_VERSION)
        for v in VECTORS['compare']:
            q = facts.validate_requirements([v['requirement']])[0]
            self.assertEqual(facts.compare_requirement(q, facts.validate_facts(v['facts']), v['today']), v['state'], v['name'])
        for v in VECTORS['invalid_requirements']:
            with self.assertRaises(ValueError, msg=v['name']): facts.validate_requirements(v['input'])
        for v in VECTORS['invalid_facts']:
            with self.assertRaises(ValueError, msg=v['name']): facts.validate_facts(v['input'])

    def test_registry_and_results_equal_js(self):
        if not shutil.which('node'): self.skipTest('node nije dostupan')
        js = subprocess.run(['node', '--input-type=module', '-e', "const F=await import('./supabase/functions/sites-platform/facts.mjs');"
                             "console.log(JSON.stringify(Object.fromEntries(Object.entries(F.FACTS).map(([k,v])=>[k,[v.label,v.type,v.dim??null,v.values??null,v.integer??false,v.min??null,v.max??null]]))))"],
                            cwd=ROOT, capture_output=True, text=True, check=True)
        self.assertEqual(json.loads(js.stdout), {k: [v['label'], v['type'], v.get('dim'), list(v['values']) if 'values' in v else None, v.get('integer', False), v.get('min'), v.get('max')] for k, v in facts.FACTS.items()})
        states = subprocess.run(['node', 'test_facts.mjs'], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip().splitlines()[-1]
        self.assertEqual(json.loads(states), [facts.compare_requirement(facts.validate_requirements([v['requirement']])[0], facts.validate_facts(v['facts']), v['today']) for v in VECTORS['compare']])

    def test_pair_text_equal_js_and_stable_without_facts(self):
        prop = dict(id=7, country='Hrvatska', city='Osijek', title='TEST ONLY farma', area=1500000.0, price=900000.0,
                    facts_json=json.dumps(dict(land_owned=fact(110, 'ha', day='2026-10-01'), truck_access=fact(False, day='2026-10-01')), ensure_ascii=False))
        plain = {k: v for k, v in prop.items() if k != 'facts_json'}
        self.assertEqual(matching.pair_text('uvjet', {**plain, 'facts_json': ''}), matching.pair_text('uvjet', plain))
        if not shutil.which('node'): self.skipTest('node nije dostupan')
        for p in (prop, plain):
            js = subprocess.run(['node', '--input-type=module', '-e', "const D=await import('./supabase/functions/sites-platform/domain.mjs');"
                                 "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(D.pairText('uvjet',JSON.parse(s))))"],
                                cwd=ROOT, input=json.dumps(p), capture_output=True, text=True, check=True)
            self.assertEqual(js.stdout.strip(), matching.pair_text('uvjet', p))

    def test_evaluate_semantics(self):
        now = datetime.now(timezone.utc)
        prop = dict(id=7, country='Hrvatska', city='Osijek', title='TEST ONLY farma', source='https://example.org/p/7', price=900000.0, area=1500000.0,
                    renovation=0.0, other_costs=0.0, property_type='Zemljište', condition='Neizgrađeno', status='Aktivno',
                    source_checked_on=now.date().isoformat(), legal='Uredno', legal_evidence_url='https://example.org/legal')
        def buyer(requirements=None):
            c = dict(property_types=['Zemljište'], conditions=['Neizgrađeno'], source_url='https://example.org/d/3', checked_at=now.isoformat())
            if requirements is not None: c['requirements'] = requirements
            return dict(id=3, name='TEST ONLY', preferred_countries='Hrvatska', notes='', verified=1, criteria_json=json.dumps(c))
        owned = dict(key='land_owned', op='min', value=150, unit='ha', mandatory=True, quote='kupnja 150 ha')
        self.assertEqual(matching.evaluate(prop, buyer())['status'], matching.MATCH)
        r = matching.evaluate(prop, buyer([owned]))
        self.assertIn('Uvjet zahtjeva: Zemljište u vlasništvu uključeno u prodaju', r['gaps']['property'])
        p1 = dict(prop, facts_json=json.dumps(dict(land_total=fact(150, 'ha'), land_owned=fact(110, 'ha'), land_leased=fact(40, 'ha'))))
        self.assertIn('Uvjet zahtjeva: Zemljište u vlasništvu uključeno u prodaju', matching.evaluate(p1, buyer([owned]))['rejected'])
        wish = matching.evaluate(p1, buyer([dict(owned, mandatory=False)]))
        self.assertEqual(wish['status'], matching.MATCH)
        self.assertTrue(any('želja nije ispunjena' in v for v in wish['info']))
        self.assertIn('Ispravni strukturirani podaci nekretnine', matching.evaluate(dict(prop, facts_json='{nije'), buyer([owned]))['gaps']['property'])
        self.assertIn('Ispravni strukturirani kriteriji kupca', matching.evaluate(prop, buyer([dict(owned, key='min_rooms')]))['gaps']['buyer'])

    def test_area_basis_vectors_equal_js(self):
        now = datetime.now(timezone.utc)
        prop = dict(id=7, country='Hrvatska', city='Osijek', title='TEST ONLY', source='https://example.org/p/7', price=900000.0, area=1500000.0, renovation=0.0, other_costs=0.0,
                    property_type='Zemljište', condition='Neizgrađeno', status='Aktivno', source_checked_on=now.date().isoformat(), legal='Uredno', legal_evidence_url='https://example.org/legal')
        results = []
        for v in VECTORS['area_cases']:
            c = dict(property_types=['Zemljište'], conditions=['Neizgrađeno'], source_url='https://example.org/d/3', checked_at=now.isoformat(), **v['request'])
            r = matching.evaluate(dict(prop, facts_json=json.dumps(v['facts'])), dict(id=3, preferred_countries='Hrvatska', notes='', verified=1, criteria_json=json.dumps(c)))
            label = 'Površina (' + v['request']['area_basis'] + ')' if v['request'].get('area_basis') else 'Površina'
            state = 'met' if label in r['reasons'] else 'unmet' if label in r['rejected'] else 'open' if label in r['missing'] else 'absent'
            self.assertEqual(state, v['state'], v['name'])
            if v.get('note'): self.assertIn(v['note'], r['info'], v['name'])
            results.append(state)
        if shutil.which('node'):
            js = subprocess.run(['node', 'test_facts.mjs'], cwd=ROOT, capture_output=True, text=True, check=True).stderr.strip().splitlines()
            self.assertEqual(json.loads(js[0]), results)


if __name__ == '__main__':
    unittest.main()
