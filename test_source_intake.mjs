import assert from 'node:assert/strict';
import {sourceHost,intakeInput,activateSource} from './supabase/functions/registry-discovery/source-intake.mjs';
assert.equal(sourceHost('https://www.agency.example/property/1'),'agency.example');
for(const u of ['http://agency.example','https://127.0.0.1/','https://[::1]/','https://x.local/','https://user:pw@agency.example','https://agency.example:444/'])assert.throws(()=>sourceHost(u));
const v={kind:'property',name:'New Agency',url:'https://agency.example/',found_on:'https://portal.example/property/12',checked_at:new Date().toISOString()};
assert.equal(intakeInput(v).name,'New Agency');
for(const bad of [{...v,kind:'investor'},{...v,checked_at:'2020-01-01'},{...v,checked_at:'invalid'},{...v,checked_at:new Date(Date.now()+7200000).toISOString()}])assert.throws(()=>intakeInput(bad));
// An existing source without intake provenance must never be activated.
const tx=async(strings,...values)=>strings.join('').includes('body_json::jsonb as state')?[]:[];
const sql={begin:fn=>fn(tx)};
await assert.rejects(()=>activateSource(sql,{id:1}),/not eligible/);
console.log('Source intake validates evidence, HTTPS and existing-source isolation');
