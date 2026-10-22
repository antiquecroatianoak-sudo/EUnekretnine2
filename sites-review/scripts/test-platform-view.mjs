import assert from 'node:assert/strict';
import {storedMatches,sourceDescription,sourceProgress,pageWindow} from '../lib/platform-view.mjs';
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
console.log('Stored matching, source classification and import progress checks passed.');
