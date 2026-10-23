import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {storedMatches,sourceDescription,sourceProgress,pageWindow,possiblePairs,possiblePairsFilters,filterMatches,pairsView,pairsExplanation,funnelRows} from '../lib/platform-view.mjs';
import {MATCH,CANDIDATE,REJECT} from '../lib/domain.mjs';
const result=(status,score)=>JSON.stringify({status,score,reasons:[],missing:[],rejected:[]});
assert.deepEqual(pageWindow([1,2],8).rows,[1,2],'A refresh that shrinks results must not leave a blank page');
assert.equal(pageWindow([],8).page,1);
assert.equal(pageWindow(Array.from({length:31},(_,i)=>i),2).rows[0],30);
const data={properties:[{id:1},{id:2}],investors:[{id:10}],match_results:[
 {property_id:'1',investor_id:'10',result_json:result(CANDIDATE,90),updated:'2026-10-18'},
 {property_id:2,investor_id:10,result_json:result(MATCH,80)},
 {property_id:999,investor_id:10,result_json:result(MATCH,100)},
 {property_id:1,investor_id:10,result_json:'broken'}]};
assert.deepEqual(storedMatches(data).map(m=>m.property.id),[2,1]);
assert.equal(storedMatches({...data,match_results:[]}).length,0,'Do not invent pairs from properties and investors');
assert.equal(storedMatches(data)[1].updated,'2026-10-18');
assert.match(sourceDescription({kind:'buyer',body_json:'{}'}),/nepotvrđen/);
assert.match(sourceDescription({kind:'buyer',body_json:JSON.stringify({facts:{transaction_type:'buy_request'}})}),/Objava potražnje/);
const progress=sourceProgress({status:'Djelomično',body_json:JSON.stringify({pending:[{url:'https://example.com'}],inserted_count:3,updated_count:4})});
assert.equal(progress.continuing,true);assert.match(progress.summary,/3 novih/);assert.match(progress.summary,/4 ažuriranih/);
assert.equal(sourceProgress({status:'Pogreška',body_json:'broken'}).continuing,false);

// "Mogući parovi": the count and the opened list use the same stored candidates.
const pairsData={properties:[{id:1,title:'Zemljište Galway',country:'IE',region:'Galway'},{id:2,title:'Stan Split',country:'HR',city:'Split'},{id:3,title:'Kuća Ljubljana',country:'SI'}],
 investors:[{id:10,name:'Galway County Council'},{id:11,name:'Investitor d.o.o.'}],match_results:[
 {property_id:1,investor_id:10,result_json:result(CANDIDATE,60)},
 {property_id:3,investor_id:11,result_json:result(CANDIDATE,40)},
 {property_id:2,investor_id:11,result_json:result(MATCH,100)},
 {property_id:2,investor_id:10,result_json:result(REJECT,20)}]};
const stored=storedMatches(pairsData),possible=possiblePairs(stored);
assert.equal(possible.length,2,'count = stored candidates only');
assert(possible.every(m=>m.status===CANDIDATE),'a confirmed match is never counted as a possible pair');
// Filters left over from earlier work would hide candidates...
const earlier={query:'split',filterCountry:'Hrvatska',matchStatus:MATCH};
assert.equal(filterMatches(stored,earlier).filter(m=>m.status===CANDIDATE).length,0);
// ...the button's target state shows every candidate, on page 1, and nothing else.
const target=possiblePairsFilters();
assert.deepEqual(target,{tab:'Podudaranja',matchStatus:CANDIDATE,query:'',filterCountry:'Sve države',page:1});
const shown=filterMatches(stored,{...earlier,...target});
assert.deepEqual(shown.map(m=>[m.property.id,m.investor.id]),possible.map(m=>[m.property.id,m.investor.id]));
assert.equal(pageWindow(shown,target.page).page,1);
assert.equal(stored.find(m=>m.status===MATCH).status,MATCH,'opening candidates never changes a stored status');
// Zero candidates: the count is 0 and the opened list is empty, not other statuses.
const none=storedMatches({...pairsData,match_results:pairsData.match_results.filter(r=>JSON.parse(r.result_json).status!==CANDIDATE)});
assert.equal(possiblePairs(none).length,0);
assert.equal(filterMatches(none,target).length,0);
assert.equal(possiblePairs(storedMatches({})).length,0,'no data yet: count 0, no invented pairs');
// The component wires the button to this target and shows the same count.
const source=readFileSync(new URL('../app/platform.tsx',import.meta.url),'utf8');
assert.match(source,/possible=possiblePairs\(matches\)/);
assert.match(source,/const filteredMatches=filterMatches\(matches,\{query,filterCountry,matchStatus\}\)/);
assert.match(source,/onClick=\{openPossiblePairs\}[^>]*>.*Mogući parovi<span className='nav-count'>\{pairsUnknown\?'\?':integer\(possible\.length\)\}/);
assert.match(source,/function openPossiblePairs\(\)\{const f=possiblePairsFilters\(\);changeTab\(f\.tab\);setMatchStatus\(f\.matchStatus\);setQuery\(f\.query\);setFilterCountry\(f\.filterCountry\);setPage\(f\.page\)\}/);
// Separate pairs read: hidden links are counted with a reason; errors and real zeros are explained, never confused.
{const resp={match_results:[{property_id:1,investor_id:10,result_json:result(CANDIDATE,60)},{property_id:2,investor_id:10,result_json:result(CANDIDATE,50)},{property_id:3,investor_id:11,result_json:result(CANDIDATE,40)}],
 properties:[{id:1,visible:true},{id:2,visible:false}],investors:[{id:10,visible:true}],totals:{properties:9657,investors:74}};
 const v=pairsView(resp);
 assert.deepEqual(v.matches.map(m=>m.property.id),[1]);
 assert.deepEqual(v.hidden.map(h=>h.reason),['nekretnina je istekla ili uklonjena iz izvora','nekretnina više ne postoji']);
 assert.equal(pairsExplanation({error:'HTTP 504',matches:[]}).kind,'error');
 assert.match(pairsExplanation({error:'HTTP 504',matches:[]}).text,/nije stvarna nula/);
 assert.match(pairsExplanation({matches:[],totals:resp.totals}).text,/nema spremljenih rezultata uparivanja \(u bazi 9657 nekretnina i 74 kupaca\)/);
 assert.equal(pairsExplanation({matches:v.matches,hidden:v.hidden,filtered:0}).kind,'filtered');
 assert.match(pairsExplanation({matches:v.matches,hidden:v.hidden,filtered:1}).text,/1 skriveno jer nekretnina je istekla/);
 assert.equal(pairsExplanation({matches:v.matches,filtered:1}),null,'nothing to explain when pairs are shown');
 const rows=funnelRows({properties:3,investors:2,pairs:6,country_mismatch:2,excluded:{a:1,b:3},suggested:{x:0},properties_without_type:1,properties_without_source:0,investors_without_types:0,investors_without_source:0});
 assert.deepEqual(rows.slice(4,6),[['Isključeno: b',3],['Isključeno: a',1]],'largest exclusion first');}
console.log('Stored matching, source classification, import progress and possible-pair entry checks passed.');
