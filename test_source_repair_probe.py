import time
import unittest
from unittest.mock import patch
from source_repair_probe import probe


class ProbeTests(unittest.TestCase):
    def test_blocked_root_stops_before_details(self):
        calls = []
        class Blocked:
            def __init__(self, root): pass
            def get(self, url):
                calls.append(url)
                raise ValueError('robots.txt disallows this URL')
        row = probe({'id': 1, 'name': 'Agency', 'url': 'https://agency.example/'},
                    time.monotonic()+10, Blocked)
        self.assertEqual(row['status'], 'access_blocked')
        self.assertEqual(len(calls), 1)
        self.assertEqual(row['writes'], 0)

    def test_detail_budget_and_no_external_fetch(self):
        calls = []
        class Public:
            def __init__(self, root): pass
            def get(self, url):
                calls.append(url)
                return ''.join('<a href="/property/'+str(n)+'">For sale</a>'
                               for n in range(1000, 1010))
        with patch('source_repair_probe.safe_url', side_effect=lambda url, root: url):
            row = probe({'id': 1, 'name': 'Agency', 'url': 'https://agency.example/'},
                        time.monotonic()+10, Public)
        self.assertEqual(row['status'], 'observed')
        self.assertEqual(len(calls), 3)
        self.assertFalse(row['activation_performed'])


if __name__ == '__main__': unittest.main()
