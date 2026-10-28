// Exercise the actual server route with only identity and the remote gateway stubbed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('package.json','file://'+process.argv[2]+'/'));
const {transformSync}=require('esbuild');
let signedIn=true,calls=[];
globalThis.__routeAuth=async()=>signedIn?{id:'test-owner'}:null;
globalThis.__routeGateway=async body=>{calls.push(body);return {ok:true}};
let source=readFileSync(new URL('../app/api/platform/route.ts',import.meta.url),'utf8')
 .replace(/import \{getChatGPTUser\} from [^;]+;/,"const getChatGPTUser=globalThis.__routeAuth;")
 .replace(/import \{gateway\} from [^;]+;/,"const gateway=globalThis.__routeGateway;");
const {POST,GET}=await import('data:text/javascript;base64,'+Buffer.from(transformSync(source,{loader:'ts',format:'esm'}).code).toString('base64'));
const request=(action,origin='https://test.local')=>new Request('https://test.local/api/platform',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({action,property_id:1,investor_id:2})});
for(const action of ['pair','pair_question','pair_answer','pair_stage','source_check','pairs','sources','catalog','pair_diagnostics','completion_queue','refresh','save_property','save_investor','prepare','activity','import','workflow','buyer_requests','save_request','offer_create','offer_approve','offer_response','agency_package','partner_proposals','partner_decide','partner_grant_create','partner_grant_revoke']){
 const response=await POST(request(action));assert.equal(response.status,200,action);assert.equal(calls.at(-1).action,action);
}
let count=calls.length;
assert.equal((await POST(request('pair','https://evil.example'))).status,403);assert.equal(calls.length,count);
assert.equal((await POST(request('unknown'))).status,400);assert.equal(calls.length,count);
// Partner staging is internal only (module 7): the owner route never forwards it.
assert.equal((await POST(request('partner_stage'))).status,400);assert.equal(calls.length,count);
signedIn=false;assert.equal((await POST(request('pair'))).status,401);assert.equal((await GET()).status,401);assert.equal(calls.length,count);
// Print route: signed-in only, renders only a current stored version, never an agency package, draft unless approved in the business phase.
signedIn=true;
const printSource=readFileSync(new URL('../app/api/offer-print/route.ts',import.meta.url),'utf8')
 .replace(/import \{getChatGPTUser\} from [^;]+;/,"const getChatGPTUser=globalThis.__routeAuth;")
 .replace(/import \{gateway\} from [^;]+;/,"const gateway=(...a)=>globalThis.__routeGateway(...a);")
 .replace(/from '@\/lib\/offer\.mjs'/,'from '+JSON.stringify(new URL('../lib/offer.mjs',import.meta.url).href));
const print=(await import('data:text/javascript;base64,'+Buffer.from(transformSync(printSource,{loader:'ts',format:'esm'}).code).toString('base64'))).GET;
const presentation={code:'EU-T',title:'T',subtitle:'S',description:'Opis',request:[],reasons:[],availability:'A',next:'N'};
let workflow={business_phase:false,readiness:{ready:true},offers:[{id:'5',number:1,current:true,approved:true,presentation},{id:'6',number:2,current:false,approved:true,presentation}],history:[{id:'7',type:'handoff',agency_name:'TAJNA AGENCIJA'}]};
globalThis.__routeGateway=async body=>{calls.push(body);return workflow};
const url=q=>new Request('https://test.local/api/offer-print?property_id=1&investor_id=2&offer_id='+q);
let page=await print(url('5'));let html=await page.text();
assert.equal(page.status,200);assert.equal(calls.at(-1).action,'workflow');assert(html.includes('INTERNI NACRT'),'draft while the business phase is off');assert(!html.includes('TAJNA AGENCIJA'));
assert.match(page.headers.get('content-security-policy'),/default-src 'none'/);assert.equal(page.headers.get('cache-control'),'private, no-store');
workflow={...workflow,business_phase:true};html=await (await print(url('5'))).text();assert(html.includes('Pregledano za procjenu interesa'));
assert.equal((await print(url('6'))).status,400,'a stale version is not printed');assert.equal((await print(url('7'))).status,400,'an agency package is never printed as an offer');
assert.equal((await print(new Request('https://test.local/api/offer-print?property_id=abc&investor_id=2&offer_id=5'))).status,400);
signedIn=false;count=calls.length;assert.equal((await print(url('5'))).status,401);assert.equal(calls.length,count);
console.log('Platform route checks passed: pair and offer workflow actions reach gateway; unauthenticated, cross-origin and unknown actions remain blocked; print route renders only current stored versions.');

