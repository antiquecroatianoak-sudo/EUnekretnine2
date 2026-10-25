// Association comes from the concrete imported source, never from an investor's seat or name.
export async function agencyDirectory(tx){return tx`select s.id,s.name,s.url,count(distinct c.property_id)::int as properties,count(distinct c.investor_id)::int as investors from sources s left join source_candidates c on c.source_id='registry-'||s.id::text where s.category ilike 'Agencija%' group by s.id,s.name,s.url order by s.name,s.id`}
export async function withAgencies(tx,rows,table){
 if(!rows.length)return rows;
 const field=table==='properties'?'property_id':'investor_id',ids=rows.map(r=>Number(r.id));
 const links=await tx`select c.${tx(field)} as record_id,s.id,s.name,s.url,c.url as record_url from source_candidates c join sources s on c.source_id='registry-'||s.id::text where c.${tx(field)}=any(${ids}::bigint[]) and s.category ilike 'Agencija%' order by c.last_seen desc,c.id`;
 return rows.map(row=>{const source=table==='properties'?row.source:(()=>{try{return JSON.parse(row.criteria_json||'{}').source_url}catch{return null}})();const agency=links.find(a=>String(a.record_id)===String(row.id)&&a.record_url===source);return agency?{...row,source_agency:{id:agency.id,name:agency.name,url:agency.url,record_reference:agency.record_url}}:row});
}
