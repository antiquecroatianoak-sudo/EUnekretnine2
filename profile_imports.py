"""Limited real imports for reviewed, configured acquisition profiles.
Uses the existing registry batch endpoint and URL deduplication. Active sources
remain the responsibility of the normal registry importer.
"""
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

def run(config, api, fetcher_factory, page_class, listing_record, now=None, previous=None):
    now = now or datetime.now(timezone.utc)
    results = []
    prior_results = {r['source_id']:r for r in (previous or {}).get('results',[])}
    for source in config.get("diagnostic_sources", []):
        if source.get("is_active"):
            continue
        sid = "registry-" + str(source["id"])
        settings = config.get("states", {}).get("registry-config-" + str(source["id"]), {})
        profile = settings.get("buyer_profile")
        if not profile:
            continue
        prior = config.get("states", {}).get(sid, {})
        retry = prior_results.get(sid, {}).get("retry_after") or prior.get("retry_after")
        if retry and datetime.fromisoformat(retry) > now:
            results.append(dict(source_id=sid,status="cooldown",retry_after=retry));continue
        if len(results) >= 10:
            break
        try:
            if profile.get("url", "").rstrip("/") != source["url"].rstrip("/"):
                raise ValueError("Reviewed profile URL differs from registered source")
            source = dict(source, import_config=settings)
            page = page_class(fetcher_factory(source["url"]).get(source["url"]))
            row = listing_record(source, source["url"], page, "buyer", now.isoformat())
            response = api(dict(action="batch", source_id=sid, candidates=[row]))
            if response.get("candidates") != 1 or response.get("inserted",0)+response.get("updated",0) != 1:
                raise RuntimeError("Batch did not confirm the candidate write")
            results.append(dict(source_id=sid,status="batch_confirmed",url=row["url"],
                                inserted=response.get("inserted",0),updated=response.get("updated",0),
                                note="Verify stored evidence before source activation"))
        except Exception as error:
            # No activation, no registry checkpoint mutation, no fallback to invented facts.
            results.append(dict(source_id=sid,status="failed",error=type(error).__name__+": "+str(error)[:240],retry_after=(now+timedelta(days=1)).isoformat()))
    return dict(checked_at=now.isoformat(),results=results,activation_performed=False)

def main():
    from registry_discovery import api, Fetcher, Page, listing_record
    path=Path("data/profile_imports.json")
    previous=json.loads(path.read_text()) if path.exists() else {}
    report=run(api({"action":"registry"}),api,Fetcher,Page,listing_record,previous=previous)
    temp=path.with_suffix(".tmp")
    temp.write_text(json.dumps(report,ensure_ascii=False,indent=1)+"\n")
    temp.replace(path)
    print(json.dumps(report,ensure_ascii=False))
if __name__=="__main__":main()
