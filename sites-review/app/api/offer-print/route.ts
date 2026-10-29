import {getChatGPTUser} from '../../chatgpt-auth';
import {gateway} from '@/lib/gateway';
import {presentationHtml} from '@/lib/offer.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"};
export async function GET(req:Request){
 if(!await getChatGPTUser())return new Response('Potrebna je prijava.',{status:401,headers});
 try{const q=new URL(req.url).searchParams;const property_id=Number(q.get('property_id')),investor_id=Number(q.get('investor_id'));if(![property_id,investor_id].every(n=>Number.isSafeInteger(n)&&n>0))throw Error();
 const d=await gateway({action:'workflow',property_id,investor_id}) as any;
 const o=d.offers.find((v:any)=>v.id===q.get('offer_id'));if(!o||!o.current)throw Error();
 return new Response(presentationHtml(o.presentation,{version:o.number,approved:o.approved&&d.readiness.ready&&d.business_phase}),{headers});
 }catch{return new Response('Aktualna verzija nije dostupna. Otvori detalj para i pripremi novu verziju.',{status:400,headers})}
}
