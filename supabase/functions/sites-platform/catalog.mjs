import {PROPERTY_ACTIVE} from './activity-policy.mjs';
// Shared by the initial read and keyset pages; all SQL fragments are constants.
export const PROPERTY_VISIBLE=`${PROPERTY_ACTIVE} and not exists(select 1 from source_candidates c join site_private.listing_lifecycle l on l.candidate_id=c.id where c.property_id=p.id and l.state in ('expired','removed')) and (p.bid_deadline_at is null or p.bid_deadline_at>now()) and (site_private.safe_stamp(p.available_until) is null or site_private.safe_stamp(p.available_until)>now())`;
export const INVESTOR_VISIBLE=`not exists(select 1 from source_candidates c join site_private.listing_lifecycle l on l.candidate_id=c.id where c.investor_id=i.id and l.state in ('expired','removed'))`;
export const CATALOG_PAGE_SIZE=100;
// Numeric monotone IDs avoid skipped rows when earlier records disappear between requests.
// A high-water mark excludes newly inserted rows until refresh; no fixed overall row maximum.
export async function catalogPage(tx,a){
 if(!['properties','investors'].includes(a.table))throw Error('Nepoznat katalog.');
 const after=Number(a.after??0),limit=Number(a.limit??CATALOG_PAGE_SIZE),requested=a.through==null?null:Number(a.through);
 if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(limit)||limit<1||limit>500||requested!==null&&(!Number.isSafeInteger(requested)||requested<0||requested<after))throw Error('Nevaljana stranica kataloga.');
 const record=a.record_id==null?null:Number(a.record_id);if(record!==null&&(!Number.isSafeInteger(record)||record<=0))throw Error('Nevaljana oznaka zapisa.');
 const q=String(a.query??'').trim().toLocaleLowerCase('hr'),country=String(a.country??''),legal=String(a.legal??''),price=a.price==null||a.price===''?null:Number(a.price);
 if(q.length>200||country.length>100||legal.length>50||price!==null&&(!Number.isFinite(price)||price<0))throw Error('Nevaljan filtar kataloga.');
 const agency=a.agency_id==null||a.agency_id===''?null:Number(a.agency_id);if(agency!==null&&(!Number.isSafeInteger(agency)||agency<=0))throw Error('Nevaljana agencija.');
 const property=a.table==='properties',alias=property?'p':'i';
 const [{max}]=await tx`select coalesce(max(id),0) as max from ${tx(a.table)}`;
 const through=requested??Number(max);
 // Search is literal substring matching, including % and _, never user-supplied SQL.
 const search=property?`lower(concat_ws(' ',p.title,p.city,p.region))`:`lower(concat_ws(' ',i.name,i.preferred_countries))`;
 const visible=property?PROPERTY_VISIBLE:INVESTOR_VISIBLE;
 const predicate=tx`${tx.unsafe(visible)} and (${record}::bigint is null or ${tx.unsafe(alias+'.id')}=${record}) and ${tx.unsafe(alias+'.id')}<=${through} and (${q}='' or strpos(${tx.unsafe(search)},${q})>0) and (${country}='' or ${tx.unsafe(alias+'.country')}=any(${a.country_values||[country]}::text[]))`;
 const agencyFilter=agency===null?tx``:tx`and exists(select 1 from source_candidates agency_c join sources agency_s on agency_c.source_id='registry-'||agency_s.id::text where agency_s.id=${agency} and agency_s.category ilike 'Agencija%' and ${tx.unsafe('agency_c.'+(property?'property_id':'investor_id'))}=${tx.unsafe(alias+'.id')})`;
 const extra=property?tx`and (${legal}='' or p.legal=${legal}) and (${price}::numeric is null or p.price<=${price})`:tx``;
 const [rows,[counts]]=await Promise.all([
  tx`select ${tx.unsafe(alias+'.*')} from ${tx(a.table)} ${tx.unsafe(alias)} where ${predicate} ${extra} ${agencyFilter} and ${tx.unsafe(alias+'.id')}>${after} order by ${tx.unsafe(alias+'.id')} limit ${limit+1}`,
  tx`select count(*)::int as total from ${tx(a.table)} ${tx.unsafe(alias)} where ${predicate} ${extra} ${agencyFilter}`,
 ]);
 const has_more=rows.length>limit,items=rows.slice(0,limit),next=has_more?Number(items.at(-1).id):null;
 return {table:a.table,items,total:counts.total,after,next,through,has_more,limit};
}

