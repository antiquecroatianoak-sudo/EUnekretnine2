import assert from 'node:assert/strict';
import {fetchPlatform,isReadRequest} from '../lib/platform-http.mjs';
const post=action=>({method:'POST',body:JSON.stringify({action})});
const pending=(_url,{signal})=>new Promise((resolve,reject)=>{
 const stop=()=>reject(new DOMException('Aborted','AbortError'));
 if(signal.aborted)stop();else signal.addEventListener('abort',stop,{once:true});
});
assert(isReadRequest());assert(isReadRequest(post('pairs')));
assert(!isReadRequest(post('save_property')));assert(!isReadRequest(post('refresh')));
assert(!isReadRequest({method:'POST',body:'broken'}));
await assert.rejects(fetchPlatform({}, {fetchImpl:pending,timeoutMs:5}),e=>e.name==='TimeoutError'&&/ostaju prikazani/.test(e.message));
const controller=new AbortController();
const cancelled=fetchPlatform({...post('catalog'),signal:controller.signal},{fetchImpl:pending});
controller.abort();await assert.rejects(cancelled,e=>e.name==='AbortError');
// The deadline also covers receiving the body, not just receiving HTTP headers.
await assert.rejects(fetchPlatform({}, {timeoutMs:5,fetchImpl:(_u,{signal})=>Promise.resolve({status:200,ok:true,text:()=>pending('',{signal})})}),e=>e.name==='TimeoutError');
await assert.rejects(fetchPlatform({}, {fetchImpl:async()=>new Response('<html>login</html>',{status:401})}),/Prijava je istekla/);
await assert.rejects(fetchPlatform({}, {fetchImpl:async()=>new Response('broken',{status:200})}),/nije valjan/);
await assert.rejects(fetchPlatform({}, {fetchImpl:async()=>Response.json({error:'Backend unavailable'},{status:503})}),/Backend unavailable/);
assert.deepEqual(await fetchPlatform({}, {fetchImpl:async()=>Response.json({count:180})}),{count:180});
let writes=0;
const saved=await fetchPlatform(post('save_property'),{timeoutMs:1,fetchImpl:async(_u,init)=>{
 writes++;assert.equal(init.signal,undefined);await new Promise(r=>setTimeout(r,10));return Response.json({id:1});
}});
assert.deepEqual(saved,{id:1});assert.equal(writes,1,'a slow write is never timed out or retried by this helper');
console.log('Platform HTTP: read cancellation, stalled body timeout, auth/errors and no write timeout/retry passed');
