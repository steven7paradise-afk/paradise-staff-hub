import { boundedBody } from '@/lib/mcp/security';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { eligibleStaffWhere } from '@/lib/google-business/reviews';
import { reviewsAdmin, privateJson } from '@/lib/google-business/access';
export async function POST(request:Request) {
 let user_id:string;try{user_id=await reviewsAdmin(request);}catch{return privateJson({error:'Accesso riservato ai super admin.'},403);}
 try {
  const {id,staff_ids}=z.object({id:z.string().min(1).max(500),staff_ids:z.array(z.string().min(1).max(100)).max(100)}).parse(JSON.parse(await boundedBody(request)));
  if(new Set(staff_ids).size!==staff_ids.length || await prisma.user.count({where:{id:{in:staff_ids},...eligibleStaffWhere}})!==staff_ids.length)return privateJson({error:'Scegli un collaboratore attivo di Saloni o Sarta.'},400);
  await prisma.$transaction(async tx=>{
   await tx.googleBusinessReview.update({where:{id},data:{match_type:'manuale',manual_match:true}});
   await tx.googleBusinessReviewStaff.deleteMany({where:{review_id:id}});
   if(staff_ids.length)await tx.googleBusinessReviewStaff.createMany({data:staff_ids.map(staff_id=>({review_id:id,staff_id}))});
  });
  console.info(JSON.stringify({service:'google-business',event:'assigned',user_id,review_id:id,staff_ids,at:new Date().toISOString()}));
  return privateJson({ok:true});
 }catch{return privateJson({error:'Assegnazione non valida.'},400);}
}
