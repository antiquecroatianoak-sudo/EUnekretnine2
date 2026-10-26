// Historical parser failures are retained for diagnostics, not restamped as new checks.
export function currentFailedDetailURLs(state, root, validURL) {
 const checked = Date.parse(state.checked_at);
 return [...new Set((state.failed_urls || [])
  .filter(item => item.mode === 'detail' && Number.isFinite(checked) && Date.parse(item.checked_at) === checked)
  .map(item => validURL(item.url, root).replace(/\/+$/, '')))];
}

export async function applyFailedRechecks(sql, source, state, validURL) {
 const urls = currentFailedDetailURLs(state, source.url, validURL);
 // One bounded update replaces hundreds of sequential queries for old failures.
 // A fetch/parser failure is unknown availability and never reopens a closed listing.
 if (urls.length) await sql`update site_private.listing_lifecycle l
  set state='missing_once',checked_at=${state.checked_at}::timestamptz,
      reason='Aktivnost nije potvrđena pri posljednjoj provjeri'
  from source_candidates c where c.id=l.candidate_id and c.kind='property'
  and c.source_id=${'registry-'+source.id} and rtrim(c.url,'/')=any(${urls}::text[])
  and l.state not in ('expired','removed')
  and l.checked_at<${state.checked_at}::timestamptz`;
 if (state.error) await sql`update site_private.listing_lifecycle l
  set state='missing_once',checked_at=${state.checked_at}::timestamptz,
      reason='Izvor nije osvježen; potrebna ponovna potvrda aktivnosti'
  from source_candidates c where c.id=l.candidate_id and c.kind='property'
  and c.source_id=${'registry-'+source.id}
  and site_private.safe_stamp(c.last_seen)<${state.checked_at}::timestamptz
  and l.state not in ('expired','removed')
  and l.checked_at<${state.checked_at}::timestamptz`;
}

export async function applyObservedClosures(sql, source, state, validURL) {
 const observations=state.closed_urls||[];
 if(!Array.isArray(observations)||observations.length>500)throw Error('Invalid closure observations');
 // Validate the complete list before any write. Unknown status is never closure.
 const groups={removed:new Set(),expired:new Set()};
 for(const item of observations){
  if(!Object.hasOwn(groups,item.state)||Date.parse(item.checked_at)!==Date.parse(state.checked_at)||!Number.isFinite(Date.parse(item.checked_at))||typeof item.evidence!=='string'||item.evidence.trim().length<3)throw Error('Invalid closure observation');
  groups[item.state].add(validURL(item.url,source.url).replace(/\/+$/,''));
 }
 for(const [status,urls] of Object.entries(groups))if(urls.size)await sql`
  insert into site_private.listing_lifecycle(candidate_id,state,checked_at,evidence_url,reason)
  select c.id,${status},${state.checked_at}::timestamptz,c.url,'Izvor potvrdio zatvaranje ili istek oglasa'
  from source_candidates c where c.kind='property' and c.source_id=${'registry-'+source.id}
  and rtrim(c.url,'/')=any(${[...urls]}::text[])
  and site_private.safe_stamp(c.last_seen)<=${state.checked_at}::timestamptz
  on conflict(candidate_id) do update set state=excluded.state,checked_at=excluded.checked_at,
   evidence_url=excluded.evidence_url,reason=excluded.reason
  where site_private.listing_lifecycle.checked_at is null
   or site_private.listing_lifecycle.checked_at<=excluded.checked_at`;
}
