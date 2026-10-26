"""Grouped diagnostics for source imports; never enables sources or alters import cursors."""
import json
import re
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlsplit

ACCESS = re.compile(r'403|401|429|robots|captcha|access challenge|access_blocked|perfdrive', re.I)
DEMAND = re.compile(r'kupac|kupci|investitor|akvizic|kriteriji|potražnja', re.I)

def state(row):
    try:
        value = row.get("body_json") or {}
        return json.loads(value) if isinstance(value, str) else value
    except (ValueError, TypeError):
        return {}

def classify(row):
    s = state(row)
    error = ' '.join(str(v) for v in (s.get('error'),row.get('inactive_reason')) if v)
    url = urlsplit(row["url"])
    if ACCESS.search(error):
        group = "approved_access_required"
    elif row.get("is_active"):
        group = "operating_monitor"
    elif url.path.lower().endswith(".pdf"):
        group = "pdf_acquisition_profiles"
    elif DEMAND.search(row.get("category", "")):
        group = "buyer_acquisition_pages"
    elif s.get("status") == "Nepodržano" or row.get("status") == "Nepodržano":
        group = "structured_property_adapter"
    elif re.search(r'No supported listing links|header changed|No reliable listing', error, re.I):
        group = "listing_layout"
    elif re.search(r'No explicit public acquisition demand', error, re.I):
        group = "buyer_evidence_review"
    elif error:
        group = "fetch_or_persistence_failure"
    else:
        group = "empty_or_unconfirmed"
    return dict(id=row["id"], name=row["name"], url=row["url"],
                is_active=bool(row.get("is_active")), group=group,
                last_error=s.get("error"), retry_after=s.get("retry_after"))

def build_report(rows, previous=None, now=None):
    now = now or datetime.now(timezone.utc)
    prior = {str(x["id"]): x for x in (previous or {}).get("sources", [])}
    sources = []
    for row in rows:
        item = classify(row)
        old = prior.get(str(row["id"]), {})
        for key in ("probe_at", "probe", "probe_retry_after"):
            if key in old and old.get("url") == item["url"]:
                item[key] = old[key]
        if item.get('probe',{}).get('status')=='access_blocked':
            item['group']='approved_access_required'
        sources.append(item)
    return dict(schema_version=1, checked_at=now.isoformat(),
                source_count=len(sources),
                inactive_count=sum(not x["is_active"] for x in sources),
                groups=dict(Counter(x["group"] for x in sources)),
                sources=sources,
                scope="Diagnostics only; no activation, buyer verification or full coverage claim")

def due(item, now):
    if item["is_active"] or item["group"] in ("approved_access_required", "pdf_acquisition_profiles"):
        return False
    for key in ("retry_after", "probe_retry_after"):
        if item.get(key):
            try:
                if datetime.fromisoformat(item[key]) > now:
                    return False
            except ValueError:
                return False
    if item.get("probe_at"):
        try:
            if datetime.fromisoformat(item["probe_at"]) + timedelta(days=1) > now:
                return False
        except ValueError:
            return False
    return True

def probe(item, fetcher_factory, page_class, objects, now):
    """One robots-aware root request; observations are not imported records."""
    item = dict(item)
    item["probe_at"] = now.isoformat()
    try:
        page = page_class(fetcher_factory(item["url"]).get(item["url"]))
        nodes = [v for script in page.scripts for v in objects(script)]
        kinds = set()
        for node in nodes:
            value = node.get("@type", [])
            kinds.update([value] if isinstance(value, str) else value if isinstance(value, list) else [])
        text = " ".join(" ".join(page.text).split())
        item["probe"] = dict(status="observed", structured_types=sorted(kinds),
                            has_explicit_acquisition_phrase=bool(re.search(
                                r"tražimo parcele|kupujemo|acquisition criteria|purchase profile|ankaufsprofil", text, re.I)),
                            link_count=len(page.links),
                            next_action="Validate individual records, country, contact and terms before import")
    except Exception as error:
        message = type(error).__name__ + ": " + str(error)[:240]
        blocked = bool(ACCESS.search(message))
        item["probe"] = dict(status="access_blocked" if blocked else "fetch_failed", error=message)
        item["probe_retry_after"] = (now + timedelta(days=1)).isoformat()
    return item

def run_probes(report, fetcher_factory, page_class, objects, now=None, limit=20):
    now = now or datetime.now(timezone.utc)
    selected = sorted((x for x in report["sources"] if due(x, now)),
                      key=lambda x: (x.get("probe_at", ""), x["id"]))[:limit]
    # Never send concurrent requests to the same host.
    hosts = {}
    for item in selected:
        hosts.setdefault(urlsplit(item["url"]).hostname, []).append(item)
    def host_batch(items):
        return [probe(x, fetcher_factory, page_class, objects, now) for x in items]
    changed = {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        for batch in pool.map(host_batch, hosts.values()):
            changed.update({x["id"]: x for x in batch})
    report["sources"] = [changed.get(x["id"], x) for x in report["sources"]]
    report["probed_count"] = len(changed)
    report["remaining_due"] = sum(due(x, now) for x in report["sources"])
    return report

def main():
    from registry_discovery import api, Fetcher, Page, objects
    path = Path("data/source_batches.json")
    previous = json.loads(path.read_text()) if path.exists() else {}
    config = api({"action": "registry"})
    # Require the complete registry: never report an active-only list as all sources.
    rows = config.get("diagnostic_sources")
    if not isinstance(rows, list):
        raise RuntimeError("Full diagnostic registry unavailable; active imports are unaffected")
    for row in rows:
        row["body_json"] = config.get("states", {}).get("registry-" + str(row["id"]), {})
    report = run_probes(build_report(rows, previous), Fetcher, Page, objects)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n")
    temp.replace(path)
    print("Source batches:", report["groups"], "probed:", report["probed_count"],
          "remaining:", report["remaining_due"])

if __name__ == "__main__":
    main()

