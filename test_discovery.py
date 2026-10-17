import csv
import io
import json
import unittest
from datetime import datetime, timezone
from discovery import SOURCES, SourceError, parse_fina, parse_rss, parse_html, scan, public_url
from source_store import sync_snapshot, prepare_for_review
from storage import connect
from matching import ranked_matches, MATCH

NOW=datetime(2026,10,17,12,tzinfo=timezone.utc)

class DiscoveryTests(unittest.TestCase):
    def test_fina_skips_expired_and_non_property_rows(self):
        out=io.StringIO()
        writer=csv.DictWriter(out,delimiter=';',fieldnames=['Vrsta predmeta prodaje','ID nadmetanja','Datum i vrijeme završetka nadmetanja','Opis','Početna cijena za nadmetanje'])
        writer.writeheader()
        row={'Vrsta predmeta prodaje':'nekretnina','ID nadmetanja':'123','Datum i vrijeme završetka nadmetanja':'2026-10-20 12:00:00','Opis':'TEST zemljište','Početna cijena za nadmetanje':'100.50'}
        writer.writerow(row);writer.writerow(dict(row,**{'ID nadmetanja':'124','Vrsta predmeta prodaje':'pokretnina'}));writer.writerow(dict(row,**{'ID nadmetanja':'125','Datum i vrijeme završetka nadmetanja':'2020-01-01 12:00:00'}))
        found=parse_fina(SOURCES[0],out.getvalue(),NOW)
        self.assertEqual(len(found),1);self.assertEqual(found[0]['facts']['asking_price'],100.5)
        self.assertFalse(found[0]['verified'])
    def test_wrong_spanish_feed_and_changed_csv_fail(self):
        with self.assertRaises(SourceError):parse_rss(SOURCES[2],'<rss><channel><title>Reparto del caudal hereditario</title></channel></rss>',NOW)
        with self.assertRaises(SourceError):parse_fina(SOURCES[0],'header;changed\n1;2',NOW)
    def test_rss_retains_unknown_deadline_and_encodes_spaces(self):
        content='<rss><channel><title>Subastas</title><item><title>TEST</title><link>https://www.hacienda.gob.es/a b</link></item></channel></rss>'
        found=parse_rss(SOURCES[2],content,NOW)
        self.assertEqual(found[0]['url'],'https://www.hacienda.gob.es/a%20b')
        self.assertNotIn('deadline',found[0]['facts']);self.assertFalse(found[0]['verified'])
    def test_buyer_signal_does_not_invent_budget_or_intent(self):
        buyer=parse_html(SOURCES[4],'<h1>Tražimo zemljišta u zoni tramvaja 300-1500 m2</h1>',NOW)[0]
        self.assertIsNone(buyer['facts']['budget']);self.assertFalse(buyer['verified'])
        with self.assertRaises(SourceError):parse_html(SOURCES[4],'<p>Stranica više ne sadrži zahtjev</p>',NOW)
    def test_hr_notices_exclude_rental_and_jobs(self):
        html='<a href="/natjecaji/sale/">Natječaj za prodaju nekretnina</a><a href="/natjecaji/rent/">Natječaj za zakup</a><a href="/natjecaji/job/">Zapošljavanje</a>'
        self.assertEqual(len(parse_html(SOURCES[1],html,NOW)),1)
    def test_snapshot_is_idempotent_and_failure_preserves_last_seen(self):
        source=SOURCES[2]
        content='<rss><channel><title>Subastas</title><item><title>TEST</title><link>https://www.hacienda.gob.es/a</link></item></channel></rss>'
        initial=scan(fetcher=lambda *a,**k:content,now=NOW,sources=[source])
        second=scan(initial,fetcher=lambda *a,**k:content,now=NOW,sources=[source])
        self.assertEqual(len(second['candidates']),1)
        def fail(*a,**k):raise TimeoutError('test')
        failed=scan(second,fetcher=fail,now=NOW,sources=[source])
        self.assertEqual(failed['candidates'],second['candidates']);self.assertEqual(failed['runs'][0]['status'],'Pogreška')
    def test_private_or_insecure_urls_are_rejected(self):
        for url in ('http://example.org','https://user:password@example.org','https://example.org:444'):
            with self.assertRaises(ValueError):public_url(url)
    def test_source_store_deduplicates_and_draft_never_auto_verifies(self):
        snapshot=scan(fetcher=lambda *a,**k:'<rss><channel><title>Subastas</title><item><title>TEST</title><link>https://www.hacienda.gob.es/a</link></item></channel></rss>',now=NOW,sources=[SOURCES[2]])
        c=connect(path=':memory:')
        sync_snapshot(c,snapshot);sync_snapshot(c,snapshot)
        self.assertEqual(c.execute('SELECT COUNT(*) AS n FROM source_candidates').fetchone()['n'],1)
        candidate_id=snapshot['candidates'][0]['id']
        self.assertEqual(prepare_for_review(c,candidate_id),prepare_for_review(c,candidate_id))
        self.assertEqual(c.execute('SELECT COUNT(*) AS n FROM properties').fetchone()['n'],1)
        prop=dict(c.execute('SELECT * FROM properties').fetchone())
        self.assertEqual(prop['legal'],'Nepoznato');self.assertIsNone(prop['renovation'])
        self.assertEqual(c.execute('SELECT COUNT(*) AS n FROM notification_outbox').fetchone()['n'],0)
        c.execute("UPDATE properties SET title='REVIEWED'")
        sync_snapshot(c,snapshot)
        self.assertEqual(c.execute('SELECT title FROM properties').fetchone()['title'],'REVIEWED')
        c.close()
    def test_forged_verified_candidate_is_rejected_before_writes(self):
        snapshot=scan(fetcher=lambda *a,**k:'<rss><channel><title>Subastas</title><item><title>TEST</title><link>https://www.hacienda.gob.es/a</link></item></channel></rss>',now=NOW,sources=[SOURCES[2]])
        snapshot['candidates'][0]['verified']=True
        c=connect(path=':memory:')
        with self.assertRaises(ValueError):sync_snapshot(c,snapshot)
        self.assertEqual(c.execute('SELECT COUNT(*) AS n FROM source_candidates').fetchone()['n'],0)
        c.close()

if __name__=='__main__':unittest.main()
