import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const repo='antiquecroatianoak-sudo/EUnekretnine2';
const good={repository_id:'1422569624',repository_owner_id:'343548834',repository:repo,repository_visibility:'public',ref:'refs/heads/main',sub:'repo:antiquecroatianoak-sudo@343548834/EUnekretnine2@1422569624:ref:refs/heads/main',workflow_ref:repo+'/.github/workflows/discovery.yml@refs/heads/main',event_name:'push'};
for(const name of ['discovery-sync','registry-discovery']){
 const source=readFileSync(new URL('./supabase/functions/'+name+'/index.js',import.meta.url),'utf8');
 const expression=source.match(/const checks=(\{[^\n]+?\}); const failed=/)?.[1];assert.ok(expression);
 const checks=payload=>vm.runInNewContext('('+expression+')',{payload,repo});
 for(const event_name of ['push','schedule','workflow_dispatch'])assert.ok(Object.values(checks({...good,event_name})).every(Boolean));
 for(const [field,value] of Object.entries({repository_id:'1',repository_owner_id:'2',repository:'other/fork',repository_visibility:'private',ref:'refs/heads/other',sub:'repo:other/fork:ref:refs/heads/main',workflow_ref:repo+'/.github/workflows/other.yml@refs/heads/main',event_name:'pull_request'})){
  assert.equal(checks({...good,[field]:value})[field],false, name+' rejects changed '+field);
  const missing={...good};delete missing[field];assert.equal(checks(missing)[field],false,name+' requires '+field);
 }
}
console.log('Public identity gate checks passed: only exact owner/repository/main/workflow, supported events; private, forks, missing and changed claims refused.');
