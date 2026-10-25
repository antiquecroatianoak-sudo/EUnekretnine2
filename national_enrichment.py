"""Country-fair bounded enrichment, authenticated by existing GitHub OIDC policy."""
import json
from urllib.request import Request, urlopen
from sync_discovery import request_token

ENDPOINT = 'https://izpzsfiqvransehvmuzn.supabase.co/functions/v1/registry-discovery'
COUNTRIES = 'HR FR NL AT BE BG CY CZ DK EE FI DE GR HU IE IT LV LT LU MT PL PT RO SK SI ES SE'.split()

def main():
    errors = []
    for country in COUNTRIES:
        try:
            # At most 100 existing records per country per scheduled pass. Cursors
            # persist in independent enrichment:* checkpoints; no registry-* changes.
            request = Request(ENDPOINT, data=json.dumps({'action': 'enrichment-country', 'country': country}).encode(),
                              headers={'Authorization': 'Bearer ' + request_token(), 'Content-Type': 'application/json'}, method='POST')
            with urlopen(request, timeout=90) as response:
                result = json.load(response)
            print(country, 'processed', result['processed'], 'outcomes', result['counts'], 'cycle_complete', result['cycle_complete'])
        except Exception as error:
            # Do not print tokens, complete request payloads or private record URLs.
            print(country, 'enrichment failed:', type(error).__name__)
            errors.append(country)
    if errors:
        raise RuntimeError('Enrichment failed for: ' + ', '.join(errors))

if __name__ == '__main__':
    main()
