import { boundedBody } from '@/lib/mcp/security';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { availableLocations } from '@/lib/google-business/oauth';
import { reviewsAdmin, privateJson } from '@/lib/google-business/access';
export async function GET() {
 try{await reviewsAdmin();}catch{return privateJson({error:'Accesso riservato ai super admin.'},403);}
 try{return privateJson({locations:await availableLocations()});}catch{return privateJson({error:'Impossibile leggere le sedi. Verifica autorizzazione Google, approvazione API e permessi dell’account.'},502);}
}
export async function POST(request:Request) {
 let user_id:string;try{user_id=await reviewsAdmin(request);}catch{return privateJson({error:'Accesso riservato ai super admin.'},403);}
 try {
  const {name}=z.object({name:z.string().regex(/^accounts\/\d+\/locations\/\d+$/)}).parse(JSON.parse(await boundedBody(request)));
  const location=(await availableLocations()).find(l=>l.name===name);
  if(!location || !/paradise/i.test(location.title) || !/buenos\s+aires/i.test(location.address) || !/milano|milan\b/i.test(location.address))return privateJson({error:'Seleziona la scheda Paradise di Corso Buenos Aires, Milano.'},400);
  await prisma.googleBusinessConnection.update({where:{id:'primary'},data:{location_name:name,location_title:location.title,synced_at:null,attempted_at:null,average_rating:null,total_reviews:null,sync_error:null,lock_owner:null,lock_until:null}});
  console.info(JSON.stringify({service:'google-business',event:'location_selected',user_id,at:new Date().toISOString()}));
  return privateJson({ok:true});
 }catch{return privateJson({error:'Impossibile collegare la sede. Controlla l’accesso Google.'},400);}
}
