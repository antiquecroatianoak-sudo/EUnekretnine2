-- Read-only exported index definitions missing from the older test-schema snapshot.
CREATE UNIQUE INDEX properties_pkey ON public.properties USING btree (id);
CREATE UNIQUE INDEX properties_auction_reference_unique ON public.properties USING btree (auction_reference) WHERE (auction_reference IS NOT NULL);
CREATE UNIQUE INDEX investors_pkey ON public.investors USING btree (id);
CREATE UNIQUE INDEX source_candidates_pkey ON public.source_candidates USING btree (id);
CREATE UNIQUE INDEX listing_lifecycle_pkey ON site_private.listing_lifecycle USING btree (candidate_id);
