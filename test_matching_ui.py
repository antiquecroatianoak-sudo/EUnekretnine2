"""Exercise the actual Streamlit forms against an isolated temporary database."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from datetime import datetime, timezone
import storage
from matching import ranked_matches, MATCH, REJECT
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

if __name__=='__main__': unittest.main()
