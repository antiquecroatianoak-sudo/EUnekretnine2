"""Exercise the actual Streamlit forms against an isolated temporary database."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from datetime import datetime, timezone
import storage
from matching import ranked_matches, refresh_matches, MATCH, REJECT
from streamlit.testing.v1 import AppTest

class MatchingUITests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.db=str(Path(self.tmp.name)/'ui.db')
        original=storage.connect
        self.patcher=patch('storage.connect',side_effect=lambda **kwargs: original(path=self.db))
        self.patcher.start()
        self.original=original
        self.app=AppTest.from_file('app.py',default_timeout=20).run()
    def tearDown(self):
        self.patcher.stop(); self.tmp.cleanup()
    def field(self, kind, label):
        return next(x for x in getattr(self.app,kind) if x.label==label)
    def set_field(self, kind, label, value):
        self.field(kind,label).set_value(value)
    def submit(self,label):
        self.field('button',label).click().run()
        self.assertEqual(list(self.app.exception),[])
    def add_property(self):
        for label,value in [('Grad','Zagreb'),('Naziv nekretnine','TEST kuća'),('URL izvornog oglasa','https://example.org/property'),('URL dokaza pravne provjere','https://example.org/legal')]:
            self.set_field('text_input',label,value)
        for label,value in [('Vrsta nekretnine','Kuća'),('Stanje / namjena radova','Za obnovu'),('Pravni status','Uredno')]:
            self.set_field('selectbox',label,value)
        for label,value in [('Tražena cijena EUR',100.),('Površina m²',100.),('Procjena obnove / rušenja i radova EUR',50.),('Ostali troškovi EUR',20.)]:
            self.set_field('number_input',label,value)
        self.submit('Spremi nekretninu')
    def test_create_match_edit_budget_and_preserve_one_result(self):
        self.add_property()
        for label,value in [('Naziv kupca / tvrtke','TEST kupac'),('URL dokaza zahtjeva kupca','https://example.org/mandate'),('Datum provjere zahtjeva (YYYY-MM-DD)',datetime.now(timezone.utc).date().isoformat())]:
            self.set_field('text_input',label,value)
        self.set_field('number_input','Maksimalni ukupni budžet EUR',200.)
        self.set_field('multiselect','Zanimljive države',['Hrvatska'])
        self.set_field('multiselect','Tražene vrste nekretnina',['Kuća'])
        self.set_field('multiselect','Prihvatljivo stanje / obnova / rušenje',['Za obnovu'])
        self.set_field('checkbox','Zahtjev i kriteriji kupca potvrđeni su na navedenom izvoru',True)
        self.submit('Spremi kupca i kriterije')
        c=self.original(path=self.db)
        self.assertEqual(ranked_matches(c)[0]['status'],MATCH)
        c.close()
        self.field('selectbox','Novi kupac ili uređivanje zahtjeva').set_value(1).run()
        self.set_field('number_input','Maksimalni ukupni budžet EUR',120.)
        self.submit('Spremi kupca i kriterije')
        c=self.original(path=self.db)
        results=ranked_matches(c)
        self.assertEqual(len(results),1)
        self.assertEqual(results[0]['status'],REJECT)
        self.assertEqual(c.execute('SELECT COUNT(*) AS n FROM investors').fetchone()['n'],1)
        c.close()
    def test_property_without_legal_evidence_cannot_claim_clear(self):
        self.set_field('text_input','Naziv nekretnine','TEST')
        self.set_field('text_input','URL izvornog oglasa','https://example.org/property')
        self.set_field('selectbox','Pravni status','Uredno')
        self.submit('Spremi nekretninu')
        self.assertTrue(any('dokaz' in x.value for x in self.app.error))
        c=self.original(path=self.db)
        self.assertEqual(c.execute('SELECT COUNT(*) AS n FROM properties').fetchone()['n'],0)
        c.close()
    def test_public_buyer_coverage_lists_all_27_states_equally(self):
        self.assertEqual(list(self.app.exception),[])
        metric=next(m for m in self.app.metric if m.label=='Države s testiranim javnim kupcem')
        self.assertTrue(metric.value.endswith('/27'))
        self.assertFalse(any('Prioritet' in m.label for m in self.app.metric))
        coverage=next(d.value for d in self.app.dataframe if 'Najbolji status' in d.value.columns)
        self.assertEqual(len(coverage),27)
        self.assertEqual(coverage['Država'].nunique(),27)
        self.assertIn('Javni pozivi za zemljište',self.field('selectbox','Vrsta kandidata').options)
        self.assertTrue(any('nikad nije potvrđen posao' in x.value for x in self.app.info))
    def edit_buyer(self,name,criteria,**columns):
        """Store a buyer as an import would, then rename it through the real form only."""
        c=self.original(path=self.db)
        c.execute("INSERT INTO properties(country,region,title,source,price,renovation,other_costs,property_type,status) VALUES('Irska','Kerry','TEST zemljište','https://example.ie/l/1',90000,0,0,'Zemljište','Novo')")
        row=dict(name=name,country='Irska',min_budget=None,max_budget=None,preferred_countries='Irska',notes='Javni oglas',verified=0,criteria_json=json.dumps(criteria,ensure_ascii=False));row.update(columns)
        buyer=c.execute('INSERT INTO investors('+','.join(row)+') VALUES('+','.join('?' for _ in row)+') RETURNING id',tuple(row.values())).fetchone()['id']
        c.commit();c.close()
        self.app.run()
        self.field('selectbox','Novi kupac ili uređivanje zahtjeva').set_value(buyer).run()
        self.set_field('text_input','Naziv kupca / tvrtke',name+' (uređeno)')
        self.submit('Spremi kupca i kriterije')
        self.assertEqual([e.value for e in self.app.error],[])
        c=self.original(path=self.db);saved=dict(c.execute('SELECT * FROM investors WHERE id=?',(buyer,)).fetchone())
        pair=next(m for m in ranked_matches(c) if m['investor_id']==buyer);c.close()
        return saved,json.loads(saved['criteria_json']),pair
    def test_editing_imported_buyer_keeps_unknown_budget_seat_kind_and_closed_call(self):
        # Review on 8caa88a: four form behaviours of an imported public buyer.
        criteria={'property_types':['Zemljište'],'buyer_kind':'Javno tijelo','source_url':'https://www.kerrycoco.ie/eoi/','checked_at':'2026-10-22T09:00:00+00:00',
                  'call_deadline':'2026-07-10','call_closed':'Objavljeni rok 2026-07-10 je istekao','listing_kind':'public_buy_request','candidate_source_id':'registry:buyer:'+'c'*32}
        saved,stored,pair=self.edit_buyer('Kerry County Council',criteria,country='US')
        self.assertEqual(saved['name'],'Kerry County Council (uređeno)')
        self.assertIsNone(saved['min_budget']);self.assertIsNone(saved['max_budget'])
        self.assertEqual(saved['country'],'US','a seat outside the EU is not replaced by the first EU state')
        self.assertEqual(saved['preferred_countries'],'Irska')
        self.assertEqual(stored['buyer_kind'],'Javno tijelo')
        for key in ('call_deadline','call_closed','listing_kind','candidate_source_id'):self.assertEqual(stored[key],criteria[key])
        self.assertEqual(pair['status'],REJECT)
        self.assertIn('Javni poziv kupca je zatvoren ili istekao',pair['rejected'])
    def test_note_check_is_recorded_for_exact_text_and_note_is_kept(self):
        criteria={'property_types':['Zemljište'],'conditions':['Neizgrađeno'],'source_url':'https://example.ie/eoi','checked_at':datetime.now(timezone.utc).isoformat()}
        c=self.original(path=self.db)
        c.execute("INSERT INTO properties(country,title,source,price,renovation,other_costs,property_type,condition,status,legal,legal_evidence_url) VALUES('Irska','TEST zemljište','https://example.ie/l/1',90000,0,0,'Zemljište','Neizgrađeno','Novo','Uredno','https://example.ie/legal')")
        buyer=c.execute("INSERT INTO investors(name,country,min_budget,max_budget,preferred_countries,notes,verified,criteria_json) VALUES('TEST kupac','Irska',0,100000,'Irska','Samo uz prugu',1,?) RETURNING id",(json.dumps(criteria),)).fetchone()['id']
        c.commit();c.close();self.app.run()
        self.field('selectbox','Novi kupac ili uređivanje zahtjeva').set_value(buyer).run()
        self.field('checkbox','Dodatni uvjeti iz trenutne bilješke provjereni su uz dokaz').check()
        self.field('button','Spremi kupca i kriterije').click().run()
        self.assertTrue(any('dokaz' in e.value for e in self.app.error),'a check without evidence is refused')
        self.field('checkbox','Dodatni uvjeti iz trenutne bilješke provjereni su uz dokaz').check()
        self.set_field('text_input','Dokaz provjere dodatnih uvjeta (izvor, kanal, datum)','E-pošta ureda 21.10.')
        self.submit('Spremi kupca i kriterije')
        c=self.original(path=self.db);row=dict(c.execute('SELECT notes,criteria_json FROM investors WHERE id=?',(buyer,)).fetchone())
        self.assertEqual(row['notes'],'Samo uz prugu')
        self.assertEqual(json.loads(row['criteria_json'])['notes_check']['evidence'],'E-pošta ureda 21.10.')
        self.assertEqual(next(m for m in ranked_matches(c) if m['investor_id']==buyer)['status'],MATCH)
        # Editing the note afterwards brings the manual check back.
        c.execute("UPDATE investors SET notes='Samo uz prugu i Trešnjevka' WHERE id=?",(buyer,));refresh_matches(c);c.commit()
        self.assertIn('Dodatni uvjeti iz napomena za ručnu provjeru',next(m for m in ranked_matches(c) if m['investor_id']==buyer)['missing']);c.close()
    def test_known_budget_bounds_are_still_validated(self):
        c=self.original(path=self.db);c.close()
        self.set_field('text_input','Naziv kupca / tvrtke','TEST')
        self.set_field('number_input','Minimalni ukupni budžet EUR',500.)
        self.set_field('number_input','Maksimalni ukupni budžet EUR',100.)
        self.field('button','Spremi kupca i kriterije').click().run()
        self.assertTrue(any('raspon' in e.value for e in self.app.error))
        c=self.original(path=self.db)
        self.assertEqual(c.execute('SELECT COUNT(*) AS n FROM investors').fetchone()['n'],0);c.close()

if __name__=='__main__': unittest.main()
