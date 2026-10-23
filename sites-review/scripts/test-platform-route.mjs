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
for(const action of ['pair','pair_question','pair_answer','pair_stage','refresh','save_property','save_investor','prepare','activity','import']){
 const response=await POST(request(action));assert.equal(response.status,200,action);assert.equal(calls.at(-1).action,action);
}
let count=calls.length;
assert.equal((await POST(request('pair','https://evil.example'))).status,403);assert.equal(calls.length,count);
assert.equal((await POST(request('unknown'))).status,400);assert.equal(calls.length,count);
signedIn=false;assert.equal((await POST(request('pair'))).status,401);assert.equal((await GET()).status,401);assert.equal(calls.length,count);
console.log('Platform route checks passed: new pair actions reach gateway; unauthenticated, cross-origin and unknown actions remain blocked.');
