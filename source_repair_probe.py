"""Bounded read-only evidence for inactive source repairs; never activates/imports."""
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from registry_discovery import Fetcher, Page, objects, safe_url
from property_connector import links, primary_record
from source_batches import ACCESS, due


def evidence(source, url, page):
    nodes = [node for script in page.scripts for node in objects(script)]
    stamp = datetime.now(timezone.utc).isoformat()
    result = {"url": url, "meta": {k: v for k, v in page.meta.items()
              if k in ("og:title", "og:url", "og:locale")}}
    try:
        row = primary_record(source, url, nodes, stamp, page)
        result["parser"] = "accepted_unverified"
        result["facts"] = row["facts"]
    except ValueError as error:
        result["parser"] = str(error)
    # Retain structured facts needed to implement the parser, not ad copy/images.
    excluded = {"description", "image", "logo", "review", "aggregateRating"}
    def facts(value, depth=0):
        if depth > 5:
            return "[nested]"
        if isinstance(value, dict):
            return {k: facts(v, depth+1) for k, v in value.items()
                    if k not in excluded}
        if isinstance(value, list):
            return [facts(v, depth+1) for v in value[:8]]
        return value[:500] if isinstance(value, str) else value
    result["structured"] = [facts(n) for n in nodes if n.get("@type")][:20]
    result["links"] = links(page, url, objects, safe_url, source["url"])[:12]
    result["candidate_links"] = []
    result["contact_links"] = []
    for href, label in page.links:
        if href.startswith(('mailto:', 'tel:')):
            if href not in result["contact_links"]:
                result["contact_links"].append(href)
            continue
        if not re.search(r'\d{3,}|/offer|/oglas|/objekt|/annonce|/sale|/buy', href, re.I):
            continue
        try:
            from urllib.parse import urljoin
            target = safe_url(urljoin(url, href), source['url'])
        except (ValueError, OSError):
            continue
        if target not in result["candidate_links"]:
            result["candidate_links"].append(target)
    result['candidate_links'] = result['candidate_links'][:20]
    result['contact_links'] = result['contact_links'][:10]
    # A small primary-header sample helps identify HTML-only field labels.
    result["header_sample"] = " ".join(" ".join(page.main_text or page.text).split())[:1000]
    text = ' '.join(' '.join(page.main_text or page.text).split())
    reference = re.search(r'AD(\d+)BG', url)
    if reference:
        found = re.search(r'\b'+reference[1]+r'\b', text)
        if found: result['reference_sample'] = text[max(0, found.start()-100):found.end()+1800]
    if str(source['id']) in ('94', '107', '110'):
        result['criteria_sample'] = text[1000:3500]
    return result


def probe(source, deadline, fetcher_factory=Fetcher):
    result = {"id": source["id"], "name": source["name"], "url": source["url"],
              "pages": [], "activation_performed": False, "writes": 0}
    if time.monotonic() >= deadline:
        return dict(result, status="runtime_deferred")
    try:
        fetcher = fetcher_factory(source["url"])
        page = Page(fetcher.get(source["url"]))
        result["pages"].append(evidence(source, source["url"], page))
        targets = links(page, source["url"], objects, safe_url, source["url"])
        for url in targets[:2]:
            if time.monotonic() >= deadline:
                break
            result["pages"].append(evidence(source, url, Page(fetcher.get(url))))
        result["status"] = "observed"
    except Exception as error:
        message = type(error).__name__ + ": " + str(error)[:240]
        result.update(status="access_blocked" if ACCESS.search(message) else "fetch_failed",
                      error=message)
    return result


def main():
    now = datetime.now(timezone.utc)
    report = json.loads(Path("data/source_batches.json").read_text())
    # Inspect remaining formats; source access cooldowns still apply. Recent
    # root-only diagnostics do not substitute for this detail-format inspection.
    sources = [s for s in report["sources"]
               if due(dict(s, probe_at=None), now)
               and not ACCESS.search(str(s.get("probe", {}).get("error", "")))]
    hosts = {}
    for source in sources:
        hosts.setdefault(urlsplit(source["url"]).hostname, []).append(source)
    deadline = time.monotonic() + 240
    def host_batch(items):
        return [probe(s, deadline) for s in items]
    results = []
    with ThreadPoolExecutor(max_workers=3) as pool:
        for batch in pool.map(host_batch, hosts.values()):
            results.extend(batch)
    for item in results:
        print("SOURCE_REPAIR_EVIDENCE " + json.dumps(item, ensure_ascii=False), flush=True)
    print("READ_ONLY_PROBE " + json.dumps({"checked_at": now.isoformat(),
          "sources": len(results), "writes": 0, "activation_performed": False}))


if __name__ == "__main__":
    main()
