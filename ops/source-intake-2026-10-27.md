# New-source intake and continuous expansion

The owner's 27 October list is recorded once in data/source_intake.json. RE/MAX, ERA and ImmoScout24 are existing sources and are skipped without rechecking or modifying them. Duplicate names/domains are collapsed. Twenty-nine new source/reference entries were registered as IDs 116–144; registration is not activation or an imported property count.

The existing six-hour discovery workflow now runs source_intake.py --sync before normal registry import. Checked property/buyer links discovered on source pages are registered under a host advisory lock. Existing hosts are returned without updates. The whole source registry has no total cap; each run has bounded work and persistent checkpoints. Associations contribute public links only: neither a member nor a service provider becomes a buyer automatically.

New registered sources have registry-intake-ID metadata. Original sources without that marker are outside the intake pipeline. The intake uses the same strict primary JSON-LD connector or an independently reviewed HTML adapter as normal refresh, verifies EU property country and a record-bound contact, checks robots and visible access restrictions, performs a trial write, repeats the normal refresh and requires its saved checkpoint before activation. Source-contact permission is separate from data-use permission and partnership. No accounts, fees, messages or partner claims are created.

The authenticated registry API exposes intake-register, intake-status and intake-activate under the unchanged GitHub OIDC checks. Activation additionally checks the persisted fresh EU record and normal refresh in a transaction. Cursor states, manual fields and pair histories remain under the existing merge/persist policy. Partial catalogue coverage is never complete coverage.

Supported new primary HTML contract: Interfarms /nl/object/ID. Read the matching primary ID, object country, hectares (not building floor area), currency/unknown price and the specifically named broker. A related sold card does not close the primary record; an explicitly closed primary state is rejected by the existing lifecycle policy. This is a reviewed source adapter, not permission to guess HTML fields elsewhere.

Consorto prohibits automated extraction. Esales permits an identified robots-compliant program for access, but its terms separately restrict storage/reuse without prior written consent. MSCI/Data Boutique need licensed access. Homestra/Residaro samples lack a demonstrated accessible record-bound contact; a generic footer is never substituted. Other blocked or unsupported formats stay in the registry with honest status and do not count as working imports.

A read-only GitHub probe captured the formats and access errors. Production activation, actual inserted records and final deployment version must be recorded after running the merged workflow; source registration and parser unit tests alone are insufficient evidence.
