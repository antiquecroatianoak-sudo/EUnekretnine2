"""Evidence-mapped HTML acquisition profiles shared by multiple sources.
Configuration supplies reviewed facts, each bound to an exact source quotation.
No profile is activated or promoted to a verified buyer by this parser.
"""
from urllib.parse import urlsplit
import re

EU = set("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE".split())
ALLOWED = {"property_types", "cities", "preferred_countries", "requires_buildable", "conditions"}

def normalized(value):
    return " ".join(str(value).split()).casefold()

def profile_facts(url, page, config):
    if not isinstance(config, dict) or config.get("url", "").rstrip("/") != url.rstrip("/"):
        raise ValueError("Acquisition configuration does not match this page")
    if urlsplit(url).scheme != "https":
        raise ValueError("Acquisition page must use HTTPS")
    text = " ".join(" ".join(page.text).split())
    haystack = normalized(text)
    name = config.get("entity_name")
    intent = config.get("intent_evidence")
    email = config.get("contact_email")
    if not isinstance(name, str) or len(name.strip()) < 5 or normalized(name) not in haystack:
        raise ValueError("Named buyer/representative identity missing from this page")
    if not isinstance(intent, str) or not 20 <= len(intent) <= 1000 or normalized(intent) not in haystack:
        raise ValueError("Reviewed acquisition evidence missing from this page")
    if not isinstance(email, str) or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise ValueError("Invalid profile contact")
    links = [href.casefold().split("?", 1)[0] for href, _ in page.links]
    if email.casefold() not in haystack and "mailto:" + email.casefold() not in links:
        raise ValueError("Profile contact not observed on the acquisition page")
    mode = config.get('contact_mode', 'direct')
    if mode not in ('direct', 'agency'):
        raise ValueError('Invalid acquisition contact mode')
    role_evidence = config.get('role_evidence')
    if mode == 'agency' and (not isinstance(role_evidence,str)
                            or len(role_evidence)<20
                            or normalized(role_evidence) not in haystack):
        raise ValueError('Agency acquisition role evidence missing from this page')
    facts = dict(entity_name=name, identity_source_url=url,
                 intent_evidence=intent, intent_source_url=url,
                 contact_email=email, contact_url=url,
                 contact_evidence="Contact observed on this acquisition page",
                 listing_kind="public_acquisition_profile", budget=None,
                 transaction_type="unconfirmed_acquisition_profile",
                 availability="Public criteria observed; mandate and specific interest remain unconfirmed",
                 field_evidence={}, evidence_excerpt=intent)
    facts['source_contact'] = dict(mode=mode, name=name, email=email,
                                  record_reference=url, evidence_url=url,
                                  represents_record=True, permitted=False)
    if mode == 'agency':
        facts['source_contact']['agency_name'] = name
        facts['agency_name'] = name
        facts['buyer_role'] = 'Zastupnik investitora'
        facts['role_evidence'] = role_evidence
    rules = config.get("fields", [])
    if not isinstance(rules, list) or len(rules) > 30:
        raise ValueError("Invalid acquisition field mapping")
    for rule in rules:
        key = rule.get("field")
        quote = rule.get("evidence")
        value = rule.get("value")
        if key not in ALLOWED or not isinstance(quote, str) or not 8 <= len(quote) <= 1500:
            raise ValueError("Invalid acquisition field evidence")
        if normalized(quote) not in haystack:
            raise ValueError("Acquisition field evidence changed: " + key)
        if key == "requires_buildable":
            if type(value) is not bool:
                raise ValueError("Buildability criterion must be boolean")
        elif not isinstance(value, list) or not value or any(not isinstance(x, str) or not x.strip() or len(x) > 500 for x in value):
            raise ValueError("Invalid acquisition list field")
        if key == "preferred_countries" and any(x not in EU for x in value):
            raise ValueError("Unsupported acquisition country")
        if key in facts:
            raise ValueError("Duplicate acquisition field mapping")
        facts[key] = value
        facts["field_evidence"][key] = dict(quote=quote, source_url=url)
    if not facts.get("preferred_countries") or not facts.get("property_types"):
        raise ValueError("Documented demand countries and property types are required")
    return facts

