import assert from 'node:assert/strict';
import {evaluate,MATCH,CANDIDATE,REJECT} from '../lib/domain.mjs';
import {pairReview} from '../lib/pair-review.mjs';
const now=Date.parse('2026-10-24T10:00:00Z');
const property={id:1,country:'Hrvatska',city:'Zagreb',title:'TEST ONLY',source:'https://example.org/listing',price:100000,renovation:0,other_costs:0,area:1000,property_type:'Zemljište',condition:'Neizgrađeno',legal:'Uredno',legal_evidence_url:'https://example.org/legal',status:'Aktivno',source_checked_on:'2026-10-24'};
const buyer={id:1,name:'TEST ONLY',verified:1,preferred_countries:'Hrvatska',min_budget:null,max_budget:null,criteria_json:{property_types:['Zemljište'],conditions:['Neizgrađeno'],min_area:1000,max_area:1000,source_url:'https://example.org/buyer',checked_at:'2026-10-24T09:00:00Z'}};
for(const [p,i,status,score] of [[property,buyer,MATCH,100],[{...property,condition:null},buyer,CANDIDATE,75],[{...property,area:500},buyer,REJECT,75],[{...property,source_checked_on:null},buyer,CANDIDATE,100]]){
 const result=evaluate(p,i,now),original=JSON.stringify(result),view=pairReview(result,p,i);
 assert.equal(result.status,status);assert.equal(view.score,score);assert.equal(JSON.stringify(result),original,'display never changes the stored result');
 assert.deepEqual(view.rows.filter(r=>r.state==='met').map(r=>r.label),result.reasons);
 assert.deepEqual(view.rows.filter(r=>r.state==='unmet').map(r=>r.label),result.rejected);
 assert.deepEqual(view.rows.filter(r=>r.state==='unknown').map(r=>r.label),result.missing);
 assert(view.rows.some(r=>r.label==='Budžet / ukupni trošak'&&r.state==='info'),'unknown budget is not a failure');
 assert.match(view.scoreExplanation,/ni 100 % ne znači/);
}
assert.equal(evaluate({...property,area:850},buyer,now).status,MATCH);
assert.equal(evaluate({...property,area:1250},buyer,now).status,MATCH);
assert.equal(evaluate({...property,area:849},buyer,now).status,REJECT);
assert.equal(evaluate({...property,area:1251},buyer,now).status,REJECT);
assert.equal(pairReview({reasons:[],missing:[],rejected:[]}).score,null);
console.log('Pair comparison: full, partial, critical mismatch, missing evidence at 100%, unchanged scoring and area boundaries passed.');

const {suggestion}=await import('../../supabase/functions/sites-platform/suggestions.mjs');
const legacyBuyer={...buyer,preferred_countries:'',criteria_json:{property_types:['Zemljište'],conditions:['Neizgrađeno'],min_area_m2:900,max_area_m2:1100,preferred_countries:['Hrvatska'],source_url:'https://example.org/buyer',checked_at:'2026-10-24T09:00:00Z'}};
const legacy=suggestion(property,legacyBuyer,now),legacyView=pairReview(legacy,property,legacyBuyer);
assert.equal(legacy.score,100);assert(legacyView.scored.includes('Površina'));assert.equal(legacyView.rows.find(r=>r.label==='Površina').buyer,'900 m² – 1.100 m²');assert.equal(legacyView.rows.find(r=>r.label==='Država').buyer,'Hrvatska');
