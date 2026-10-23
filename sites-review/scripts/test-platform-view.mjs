import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {storedMatches,sourceDescription,sourceProgress,pageWindow,possiblePairs,possiblePairsFilters,filterMatches} from '../lib/platform-view.mjs';
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
assert.match(source,/onClick=\{openPossiblePairs\}[^>]*>.*Mogući parovi<span className='nav-count'>\{integer\(possible\.length\)\}/);
assert.match(source,/function openPossiblePairs\(\)\{const f=possiblePairsFilters\(\);changeTab\(f\.tab\);setMatchStatus\(f\.matchStatus\);setQuery\(f\.query\);setFilterCountry\(f\.filterCountry\);setPage\(f\.page\)\}/);
console.log('Stored matching, source classification, import progress and possible-pair entry checks passed.');
