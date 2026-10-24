import {criteria,country} from './domain.mjs';
const unknown='Nije navedeno';
const list=v=>Array.isArray(v)&&v.length?v.join(', '):unknown;
const number=(v,suffix='')=>Number.isFinite(v)?new Intl.NumberFormat('hr-HR',{maximumFractionDigits:1}).format(v)+suffix:unknown;
const range=(lo,hi,suffix)=>lo==null&&hi==null?unknown:`${lo==null?'bez donje granice':number(lo,suffix)} – ${hi==null?'bez gornje granice':number(hi,suffix)}`;
// Read only: classifications and the score come exclusively from the stored evaluator result.
// Never infer a pass from matching display strings, or treat a manual evidence check as scored.
export function pairReview(result,property={},investor={}){
 const c=criteria(investor),groups=[['met','Podudara se',result.reasons||[]],['unmet','Ne podudara se',result.rejected||[]],['unknown','Nedostaje podatak / nije provjereno',result.missing||[]]];
 const facts={
  'Država':[list(String(investor.preferred_countries||'').split(',').map(v=>country(v.trim())).filter(Boolean)),country(property.country)||unknown],
  'Vrsta nekretnine':[list(c.property_types),property.property_type||unknown],
  'Stanje / obnova / rušenje':[list(c.conditions),property.condition||unknown],
  'Grad':[list(c.cities),property.city||unknown],
  'Regija':[list(c.regions),property.region||unknown],
  'Površina':[range(c.min_area,c.max_area,' m²'),number(property.area,' m²')],
  'Površina nekretnine':[range(c.min_area,c.max_area,' m²'),number(property.area,' m²')],
  'Cijena nekretnine':[range(investor.min_budget,investor.max_budget,' €'),number(property.price,' €')],
  'Potvrđena mogućnost gradnje':['Potvrđena gradnja uz dokaz',property.buildable||unknown],
  'Dokaz mogućnosti gradnje':['Dokaz mogućnosti gradnje',property.planning_evidence_url||unknown],
  'Minimalni jednostavni ROI':[number(c.min_roi,' %'),number(result.roi,' %')],
  'Dokaz pravne provjere':['Uredan pravni status uz dokaz',[property.legal,property.legal_evidence_url].filter(Boolean).join(' · ')||unknown],
  'Pravne komplikacije':['Uredan pravni status',property.legal||unknown],
  'Izvor oglasa':['Provjerljiv izvor',property.source||unknown],
  'Grad nekretnine':['Zabilježena lokacija',property.city||unknown],
  'Nekretnina više nije aktivna':['Aktivna nekretnina',property.status||unknown],
 };
 const scored=['Država','Vrsta nekretnine','Stanje / obnova / rušenje',...(c.cities?.length?['Grad']:[]),...(c.regions?.length?['Regija']:[]),...(c.min_area!=null||c.max_area!=null?['Površina']:[]),...(c.requires_buildable?['Potvrđena mogućnost gradnje']:[]),...(c.min_roi!=null?['Minimalni jednostavni ROI']:[])];
 const rows=groups.flatMap(([state,status,labels])=>[...new Set(labels)].map(label=>({label,state,status,buyer:facts[label]?.[0]||'Provjera uvjeta i dokaza',property:facts[label]?.[1]||'Provjeriti zapis i priložene dokaze',explanation:label==='Površina'?(c.area_hard?'Stroga granica kupca.':'Dopuštena tolerancija −15 %/+25 %.'):state==='unmet'?'Odstupanje ostaje blokada bez obzira na postotak.':state==='unknown'?'Dopuniti podatak ili potvrditi dokaz prije sljedeće faze.':'Potvrđeno u spremljenom izračunu.'})));
 // Budget is informational in the existing evaluator and is deliberately not counted as a pass/failure.
 rows.push({label:'Budžet / ukupni trošak',state:'info',status:'Informativno',buyer:range(investor.min_budget,investor.max_budget,' €'),property:number(result.total_cost,' €'),explanation:'Budžet ne ulazi u postotak i sam po sebi ne isključuje par.'});
 const score=Number.isFinite(result.score)&&result.score>=0&&result.score<=100?result.score:null;
 return {rows,score,scored,met:groups[0][2].length,unmet:groups[1][2].length,missing:groups[2][2].length,
  scoreExplanation:'Spremljena ocjena evaluatora: udio zadovoljenih bodovanih kriterija, zaokružen na cijeli postotak. Bodovani kriterij s nepoznatim podatkom ne donosi bod. Pravne, izvorne i ručne provjere dodatni su uvjeti; zato ni 100 % ne znači da je par potpuno provjeren. Budžet je informativan. Ocjena nije vjerojatnost prodaje.'};
}
