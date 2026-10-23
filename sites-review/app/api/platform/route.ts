import {getChatGPTUser} from '../../chatgpt-auth';
import {gateway} from '@/lib/gateway';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){
 if(!await getChatGPTUser())return Response.json({error:'Potrebna je prijava putem ChatGPT računa.'},{status:401,headers});
 try{return Response.json(await gateway({action:'read'}),{headers})}catch(e){return Response.json({error:(e as Error).message},{status:503,headers})}
}
export async function POST(req:Request){
 if(!await getChatGPTUser())return Response.json({error:'Potrebna je prijava.'},{status:401,headers});
 if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Zahtjev nije dopušten.'},{status:403,headers});
 try{
  if(Number(req.headers.get('content-length')||0)>5_000_000)throw Error('Prevelik zahtjev.');
  const text=await req.text();if(text.length>5_000_000)throw Error('Prevelik zahtjev.');const body=JSON.parse(text);
  if(!['save_property','save_investor','prepare','refresh','activity','import','pair','pair_question','pair_answer','pair_stage'].includes(body.action))throw Error('Nepoznata radnja.');
  return Response.json(await gateway(body),{headers});
 }catch(e){return Response.json({error:(e as Error).message},{status:400,headers})}
}
