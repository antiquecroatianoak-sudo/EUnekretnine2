// Structure-only accessibility checks on the real Dashboard and new-property
// form. jsdom cannot check layout/contrast; those require browser tests.
import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
const dom=new JSDOM('<!doctype html><html lang="hr"><head><title>EU application test</title></head><body><div id="root"></div></body></html>',{pretendToBeVisual:true});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true});
const {default:axe}=await import('axe-core');
const {createRoot}=await import('react-dom/client');
const {act}=await import('react');
const {default:Dashboard}=await import('./accessibility-app.mjs');
const dataset={properties:[],investors:[],match_results:[],sources:[],source_candidates:[],discovery_runs:[],activity:[],notification_outbox:[],counts:{properties:0,investors:0,match_results:0},truncated:{},settings:{business_phase:false}};
globalThis.fetch=async()=>Response.json(dataset);
const root=createRoot(document.getElementById('root'));
const results=[];
async function check(name){
 const result=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']},rules:{'color-contrast':{enabled:false}}});
 const problems=result.violations.map(v=>({rule:v.id,impact:v.impact,targets:v.nodes.flatMap(n=>n.target)}));
 results.push({name,violations:problems,passes:result.passes.length,incomplete:result.incomplete.map(v=>v.id)});
 assert.equal(problems.length,0,name+': '+JSON.stringify(problems));
}
try{
 await act(async()=>{root.render(<Dashboard userName="TEST ONLY"/>)});
 await act(async()=>{await new Promise(r=>setTimeout(r,20))});
 assert(document.querySelector('h1'),'real dashboard rendered');
 await check('Dashboard');
 const add=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Nova nekretnina'));
 assert(add,'new-property action exists');
 await act(async()=>{add.click()});
 assert(document.querySelector('[role="dialog"] form'),'real property editor rendered');
 await check('New property form');
 // Prove the check detects a genuine label regression in this rendered form.
 const input=document.createElement('input');input.type='text';document.querySelector('[role="dialog"] form').appendChild(input);
 const negative=await axe.run(document,{runOnly:{type:'rule',values:['label']}});
 assert(negative.violations.some(v=>v.id==='label'),'missing input label must fail');input.remove();
 console.log(JSON.stringify({checks:results,negativeControl:'missing label detected',notCovered:['color contrast','layout','mobile touch','screen-reader manual review']}));
}finally{await act(async()=>root.unmount());dom.window.close()}
