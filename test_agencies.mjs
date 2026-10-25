import assert from 'node:assert/strict';
import {withAgencies} from './supabase/functions/sites-platform/agencies.mjs';
const links=[{record_id:1,id:66,name:'TEST agency',url:'https://agency.example',record_url:'https://agency.example/p/1'},{record_id:2,id:67,name:'Wrong source',record_url:'https://other.example/p/2'}];
function tx(parts,...values){if(typeof parts==='string')return {identifier:parts};const text=parts.join('');assert(text.includes("s.category ilike 'Agencija%'"));return Promise.resolve(links)}
const rows=[{id:1,source:'https://agency.example/p/1',country:'HR'},{id:2,source:'https://agency.example/p/2'},{id:3,source:'https://direct.example/p/3'}],before=JSON.stringify(rows);
const properties=await withAgencies(tx,rows,'properties');assert.equal(properties[0].source_agency.name,'TEST agency');assert(!properties[1].source_agency);assert(!properties[2].source_agency);assert.equal(JSON.stringify(rows),before);
const buyers=await withAgencies(tx,[{id:1,country:'US',criteria_json:JSON.stringify({source_url:'https://agency.example/p/1'})}],'investors');assert.equal(buyers[0].source_agency.id,66);assert.equal(buyers[0].country,'US');assert(!buyers[0].contact_json,'association does not invent contact permission or client details');
console.log('Agency association tests passed: both sides, exact record source, no inference or mutation.');
