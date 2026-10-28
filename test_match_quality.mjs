// Match-quality reference set (ops/match-quality-reference-v1.json, owner directive 6470902546): synthetic TEST ONLY
// pairs with an expected outcome and reason, evaluated end to end by domain.mjs evaluate(). test_match_quality.py runs
// the same cases through matching.py and compares both. The last stdout line is the per-case outcome for that check.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const D=await import('./supabase/functions/sites-platform/domain.mjs');
const ref=JSON.parse(readFileSync(new URL('./ops/match-quality-reference-v1.json',import.meta.url),'utf8'));
const now=Date.now(),DAY=86400000;
// "@day:-40" → a date 40 days ago, "@stamp:-100" → an ISO timestamp 100 days ago.
const fill=v=>typeof v==='string'&&/^@(day|stamp):-?\d+$/.test(v)?(([,k,n])=>{const t=new Date(now+Number(n)*DAY).toISOString();return k==='day'?t.slice(0,10):t})(v.match(/^@(day|stamp):(-?\d+)$/)):
 Array.isArray(v)?v.map(fill):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,fill(x)])):v;
const contact=(u,ref=u)=>JSON.stringify({mode:'direct',name:'TEST ONLY',contact_url:u,evidence_url:u,record_reference:ref,permitted:true});
export function build(raw){
 const c=fill(raw),src='https://example.org/test-only/q/listing',demand='https://example.org/test-only/q/demand';
 const {contact_ref,...prop}=c.property||{};
 const p={id:'1',country:'Hrvatska',city:'Zagreb',title:'TEST ONLY',source:src,price:200000,area:1000,renovation:0,other_costs:0,property_type:'Zemljište',condition:'Neizgrađeno',
  status:'Aktivno',source_checked_on:fill('@day:0'),legal:'Uredno',legal_evidence_url:'https://example.org/test-only/q/legal',contact_json:contact(src,contact_ref||src),...prop};
 if(c.facts)p.facts_json=JSON.stringify(c.facts);
 const criteria={property_types:['Zemljište'],conditions:['Neizgrađeno'],source_url:demand,checked_at:fill('@stamp:0'),...(c.criteria||{})};
 const i={id:'9',name:'TEST ONLY kupac',country:'US',preferred_countries:'Hrvatska',notes:'',verified:1,contact_json:contact(demand),...(c.buyer||{}),criteria_json:JSON.stringify(criteria)};
 return {p,i};
}
const OUTCOME={[D.MATCH]:'odgovara',[D.REJECT]:'odstupa',[D.CANDIDATE]:'nedovoljno'};
// Error kinds: a wrong match is a false positive, a wrong rejection a false negative, an open result where the
// reference expects a decision is "insufficient instead of decision"; nothing else is counted as an error.
export const kind=(expected,actual)=>actual===expected?'ispravno':actual==='odgovara'?'pogrešno pozitivno':actual==='odstupa'?'pogrešno negativno':'nedovoljno umjesto odluke';
const results=ref.cases.map(c=>{const {p,i}=build(c),r=D.evaluate(p,i,now),actual=OUTCOME[r.status];
 const where=actual==='odgovara'?r.reasons:actual==='odstupa'?r.rejected:r.missing;
 return {id:c.id,group:c.group,contract:c.contract,expected:c.expected,actual,kind:kind(c.expected,actual),reason_found:where.some(v=>v.startsWith(c.label)),status:r.status}});
const supported=results.filter(r=>r.contract==='podržano');
for(const r of supported){assert.equal(r.actual,r.expected,r.id+' '+r.kind);assert(r.reason_found,r.id+': expected reason „'+ref.cases.find(c=>c.id===r.id).label+'”')}
assert(supported.length>=20&&new Set(supported.map(r=>r.expected)).size===3,'all three outcomes are represented');
const tally=Object.fromEntries(['ispravno','pogrešno pozitivno','pogrešno negativno','nedovoljno umjesto odluke'].map(k=>[k,supported.filter(r=>r.kind===k).length]));
console.error(JSON.stringify({supported:tally,outside_contract:results.filter(r=>r.contract!=='podržano').map(r=>({id:r.id,expected:r.expected,actual:r.actual,kind:r.kind}))}));
console.log(JSON.stringify(Object.fromEntries(results.map(r=>[r.id,r.actual]))));
