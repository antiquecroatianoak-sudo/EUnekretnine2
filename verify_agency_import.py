"""Bounded production smoke test through the existing main-branch OIDC API."""
from datetime import datetime,timezone
import json
from urllib.parse import urlsplit
from registry_discovery import api,Fetcher,Page,listing_record,hostkey

DETAILS={
 'immonestor.at':'https://www.immonestor.at/objekt/7582406',
 'adamant-immobilien.at':'https://www.adamant-immobilien.at/objekt/17329426',
 'immolution.at':'https://www.immolution.at/objekt/14502658',
 'raiffeisen-immobilien.at':'https://www.raiffeisen-immobilien.at/de/immobilien/kauf/7000/eisenstadt/anlegerwohnung-im-herzen-von-eisenstadt.0001011757',
 'zweitwohnsitze.com':'https://zweitwohnsitze.com/objekte/Kreischberg-Chalets-Haus-44-A.html',
}

def main():
 sources=api({'action':'registry'})['sources'];results=[]
 for host,detail in DETAILS.items():
  registered=[s for s in sources if hostkey(urlsplit(s['url']).hostname)==host]
  if len(registered)!=1:raise ValueError('Expected exactly one registered agency: '+host)
  source=registered[0];stamp=datetime.now(timezone.utc).isoformat()
  row=listing_record(source,detail,Page(Fetcher(source['url']).get(detail)),'property',stamp)
  if row['country']!='AT' or not row['facts']['asking_price']:raise ValueError('Invalid reviewed detail: '+host)
  body={'action':'batch','source_id':'registry-'+str(source['id']),'candidates':[row]}
  first=api(body);repeat=api(body)
  if first.get('inserted',0)+first.get('updated',0)!=1 or repeat.get('inserted')!=0 or repeat.get('updated')!=1:raise ValueError('Import/deduplication not confirmed: '+host)
  result={'host':host,'source_id':source['id'],'url':row['url'],'price':row['facts']['asking_price'],'country':row['country'],'first':first,'repeat':repeat}
  results.append(result);print('AGENCY_IMPORT '+json.dumps(result,ensure_ascii=False),flush=True)
 print('AGENCY_IMPORT_VERIFIED '+str(len(results)),flush=True)

if __name__=='__main__':main()
