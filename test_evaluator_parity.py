"""Seeded differential check of the two evaluators (audit 6471298345): domain.mjs evaluate() and matching.py evaluate()
must give the same status, rejection reasons and open items on perturbed TEST ONLY pairs. The buyer contact item is
excluded because only domain.mjs checks contacts (matching.py is the local Streamlit path)."""
import copy
import json
import random
import shutil
import subprocess
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import matching

ROOT = Path(__file__).parent
CONTACT_ONLY_JS = 'Upotrebljiv kontakt kupca/investitora ili njegove agencije'
JS = """import {readFileSync} from 'node:fs';const D=await import(process.argv[1]);const cases=JSON.parse(readFileSync(0,'utf8'));
const contact=u=>JSON.stringify({mode:'direct',name:'TEST ONLY',contact_url:u,evidence_url:u,record_reference:u,permitted:true});
console.log(JSON.stringify(cases.map(({p,i})=>{const r=D.evaluate({...p,contact_json:contact(p.source)},{...i,contact_json:contact('https://example.org/test-only/d')});return [r.status,r.rejected,r.missing]})));"""

now = datetime.now(timezone.utc)
day = lambda n: (now + timedelta(days=n)).date().isoformat()
stamp = lambda n: (now + timedelta(days=n)).isoformat().replace('+00:00', 'Z')
def fact(v, unit=None, **kw):
    o = dict(value=v, origin='izvor', status='potvrđeno', evidence='TEST ONLY', observed_on=day(-10)); o.update(kw)
    if unit: o['unit'] = unit
    if o['status'] != 'potvrđeno': o.pop('evidence', None)
    return o
base_p = dict(id=1, country='Hrvatska', city='Zagreb', title='TEST ONLY', source='https://example.org/test-only/f/p', price=200000.0, area=1000.0,
              renovation=0.0, other_costs=0.0, property_type='Zemljište', condition='Neizgrađeno', status='Aktivno', source_checked_on=day(0),
              legal='Uredno', legal_evidence_url='https://example.org/legal')
base_c = dict(property_types=['Zemljište'], conditions=['Neizgrađeno'], source_url='https://example.org/test-only/d', checked_at=stamp(0))
base_i = dict(id=9, name='TEST ONLY', country='US', preferred_countries='Hrvatska', notes='', verified=1)
P = [  # property perturbations
 lambda p, f: p.update(area=random.choice([None, 0, 700.0, 850.0, 849.0, 1250.0, 1251.0, 20000.0])),
 lambda p, f: p.update(price=random.choice([None, 0, 1.0])),
 lambda p, f: p.update(country=random.choice(['Slovenija', 'HR', 'hrvatska', 'Irska', ''])),
 lambda p, f: p.update(city=random.choice(['', 'Split', 'zagreb'])),
 lambda p, f: p.update(property_type=random.choice(['Kuća', 'Stan', 'Dvorac', ''])),
 lambda p, f: p.update(condition=random.choice(['Useljivo', 'Za obnovu', ''])),
 lambda p, f: p.update(status=random.choice(['Provjera', 'Prodano', 'Novo', 'Kontakt', 'Povučeno', 'Rok istekao - ishod nepoznat'])),
 lambda p, f: p.update(source_checked_on=random.choice([day(-29), day(-30), day(-31), day(1), None])),
 lambda p, f: p.update(legal=random.choice(['Nepoznato', 'Komplikacije']), legal_evidence_url=random.choice([None, 'https://example.org/legal'])),
 lambda p, f: p.update(legal_evidence_url=random.choice([None, 'nije-url'])),
 lambda p, f: p.update(available_until=random.choice([day(-1), day(0), day(30), 'nije-datum'])),
 lambda p, f: p.update(buildable=random.choice(['Da', 'Ne', None]), planning_evidence_url=random.choice([None, 'https://example.org/plan'])),
 lambda p, f: p.update(estimated_value=random.choice([None, 150000.0, 300000.0]), valuation_evidence_url=random.choice([None, 'https://example.org/val'])),
 lambda p, f: f.update({random.choice(['land_total', 'land_owned', 'land_leased']): fact(random.choice([0, 0.1, 0.12, 2, 40]), random.choice(['ha', 'm2']), status=random.choice(['potvrđeno', 'nepotvrđeno', 'proturječno']))}),
 lambda p, f: f.update(building_area=fact(random.choice([300, 1000]), 'm2', observed_on=random.choice([day(-10), day(0), day(1), '2099-01-01']))),
 lambda p, f: f.update(rooms=fact(random.choice([10, 20, 43]), 'kom', valid_until=random.choice([day(-1), day(0), day(5)]), observed_on=day(-50))),
 lambda p, f: f.update(sale_scope=fact(random.choice(['jedinica', 'cijeli projekt']), status=random.choice(['potvrđeno', 'proturječno']))),
 lambda p, f: f.update(includes_buildings=fact(random.choice([True, False]))),
]
def req(k, op, v, u=None): 
    q = dict(key=k, op=op, value=v, mandatory=random.random() < .6, quote='TEST ONLY')
    if u: q['unit'] = u
    return q
C = [  # request perturbations
 lambda c, i: c.update(min_area=random.choice([500, 1000, 1176]), **({'max_area': random.choice([1000, 800])} if random.random() < .5 else {})),
 lambda c, i: c.update(max_area=random.choice([800, 1000])),
 lambda c, i: c.update(area_hard=True, min_area=random.choice([1000, 1001])),
 lambda c, i: c.update(area_basis=random.choice(['zemljište ukupno', 'zemljište u vlasništvu', 'površina zgrada', 'korisna površina']), min_area=random.choice([300, 1000, 20000])),
 lambda c, i: c.update(property_types=random.choice([['Kuća'], ['Zemljište', 'Kuća'], [], ['Vila']])),
 lambda c, i: c.update(conditions=random.choice([['Useljivo'], [], ['Neizgrađeno', 'Za obnovu']])),
 lambda c, i: c.update(cities=random.choice([['Zagreb'], ['Split'], ['ZAGREB']])),
 lambda c, i: c.update(regions=['Grad Zagreb']),
 lambda c, i: c.update(requires_buildable=True),
 lambda c, i: c.update(min_roi=random.choice([0, 20, 60])),
 lambda c, i: c.update(checked_at=random.choice([stamp(-89), stamp(-91), stamp(1), '2026-01-01']), ),
 lambda c, i: c.update(source_url=random.choice(['', 'nije-url'])),
 lambda c, i: c.update(call_deadline=random.choice([day(-1), day(0), day(10), 'x'])),
 lambda c, i: c.update(call_closed='expired'),
 lambda c, i: c.update(requirements=[req(*random.choice([('rooms', 'min', 20, 'kom'), ('rooms', 'max', 20, 'kom'), ('land_leased', 'max', 0, 'ha'), ('sale_scope', 'includes', ['jedinica']),
                                                          ('includes_buildings', 'equals', True), ('land_owned', 'min', 1, 'ha'), ('building_area', 'min', 500, 'm2')]))
                                    for _ in range(random.randint(1, 2))]),
 lambda c, i: i.update(preferred_countries=random.choice(['', 'Slovenija', 'HR', 'Hrvatska, Irska', 'hrvatska'])),
 lambda c, i: i.update(verified=0),
 lambda c, i: i.update(min_budget=random.choice([None, 100000.0, 300000.0]), max_budget=random.choice([None, 150000.0, 500000.0])),
 lambda c, i: i.update(notes='Samo uz more'),
]
def generate(seed, N):
    random.seed(seed)
    cases = []
    for n in range(N):
        p, c, i, f = copy.deepcopy(base_p), copy.deepcopy(base_c), copy.deepcopy(base_i), {}
        for _ in range(random.choice([0, 1, 1, 2, 2, 3])):
            if random.random() < .5: random.choice(P)(p, f)
            else: random.choice(C)(c, i)
        if c.get('requirements'):
            seen = set(); c['requirements'] = [q for q in c['requirements'] if (q['key'], q['op']) not in seen and not seen.add((q['key'], q['op']))]
        if f: p['facts_json'] = json.dumps(f, ensure_ascii=False)
        p['id'] = n; p['source'] = f'https://example.org/test-only/f/p{n}'; i['criteria_json'] = json.dumps(c, ensure_ascii=False)
        cases.append(dict(p=p, i=i))

    return cases


class EvaluatorParityTests(unittest.TestCase):
    def test_js_and_python_agree(self):
        if not shutil.which('node'): self.skipTest('node nije dostupan')
        cases = generate(20261028, 1500)
        js = json.loads(subprocess.run(['node', '--input-type=module', '-e', JS, str(ROOT / 'supabase/functions/sites-platform/domain.mjs')],
                                       input=json.dumps(cases, ensure_ascii=False), capture_output=True, text=True, check=True, cwd=ROOT).stdout)
        statuses, differences = set(), []
        for n, (case, (status, rejected, missing)) in enumerate(zip(cases, js)):
            r = matching.evaluate(case['p'], case['i'])
            statuses.add(r['status'])
            if (r['status'], sorted(r['rejected']), sorted(set(r['missing']) - {CONTACT_ONLY_JS})) != (status, sorted(rejected), sorted(set(missing) - {CONTACT_ONLY_JS})):
                differences.append((n, status, rejected, r['status'], r['rejected']))
        self.assertEqual(len(statuses), 3, 'all three outcomes are exercised')
        self.assertEqual(differences[:5], [])


if __name__ == '__main__':
    unittest.main()
