import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { addDays, dayStart, romeDate, romeIso } from '@/lib/mcp/time';
import { matchReviewStaff } from './matching';
import { accessToken, googleGet } from './oauth';
const Review = z.object({reviewId:z.string().min(1),starRating:z.enum(['ONE','TWO','THREE','FOUR','FIVE']),comment:z.string().optional(),reviewer:z.object({displayName:z.string().optional()}).optional(),createTime:z.iso.datetime({offset:true}),updateTime:z.iso.datetime({offset:true}),reviewReply:z.object({comment:z.string().optional(),updateTime:z.iso.datetime({offset:true}).optional()}).optional()});
const Page=z.object({reviews:z.array(Review).default([]),averageRating:z.number().min(0).max(5).default(0),totalReviewCount:z.number().int().nonnegative(),nextPageToken:z.string().optional()});
export const eligibleStaffWhere={active:true,employee_status:{not:'Ex dipendente'},department_key:{in:['saloni','sarta']}};
export async function syncReviews() {
 const now=new Date(),owner=randomUUID();
 const claim=await prisma.googleBusinessConnection.updateMany({where:{id:'primary',location_name:{not:null},OR:[{lock_until:null},{lock_until:{lt:now}}]},data:{lock_owner:owner,lock_until:new Date(now.getTime()+15*60000),attempted_at:now}});
 if(!claim.count)return {skipped:true};
 try {
  const connection=await prisma.googleBusinessConnection.findUniqueOrThrow({where:{id:'primary'}});
  const parent=connection.location_name!;
  if(!/^accounts\/\d+\/locations\/\d+$/.test(parent))throw new Error('Seleziona una scheda Google valida.');
  const token=await accessToken();
  const reviews=new Map<string,z.infer<typeof Review>>();let page='';let official:{averageRating:number;totalReviewCount:number}|null=null;
  const seen=new Set<string>();
  do {
   if(seen.has(page))throw new Error('Paginazione Google incompleta. Riprova la sincronizzazione.');seen.add(page);
   const data=Page.parse(await googleGet(`https://mybusiness.googleapis.com/v4/${parent}/reviews?pageSize=50&orderBy=updateTime%20desc&pageToken=${encodeURIComponent(page)}`,token));
   official??={averageRating:data.averageRating,totalReviewCount:data.totalReviewCount};
   for(const review of data.reviews) reviews.set(review.reviewId,review);
   page=data.nextPageToken || '';
   const renewed=await prisma.googleBusinessConnection.updateMany({where:{id:'primary',lock_owner:owner},data:{lock_until:new Date(Date.now()+15*60000)}});
   if(!renewed.count)throw new Error('Sincronizzazione sostituita da una nuova richiesta.');
  }while(page);
  const staff=await prisma.user.findMany({where:eligibleStaffWhere,select:{id:true,name:true}});
  await prisma.$transaction(async tx=>{
   const valid=await tx.googleBusinessConnection.updateMany({where:{id:'primary',lock_owner:owner,location_name:parent},data:{synced_at:new Date(),average_rating:official!.averageRating,total_reviews:official!.totalReviewCount,sync_error:null}});
   if(!valid.count)throw new Error('La scheda collegata è cambiata durante la sincronizzazione.');
   for(const review of reviews.values()) {
    const id=`${parent}/reviews/${review.reviewId}`;
    const data={location_name:parent,rating:['ONE','TWO','THREE','FOUR','FIVE'].indexOf(review.starRating)+1,comment:review.comment || null,reviewer_name:review.reviewer?.displayName || 'Utente Google',created_at:new Date(review.createTime),updated_at:new Date(review.updateTime),reply_text:review.reviewReply?.comment || null,replied_at:review.reviewReply?.updateTime?new Date(review.reviewReply.updateTime):null};
    await tx.googleBusinessReview.upsert({where:{id},create:{id,...data},update:data});
    const staff_ids=matchReviewStaff(data.comment,staff);
    // Manual assignment (including explicit unassignment) always wins, also during concurrent sync.
    const changed=await tx.googleBusinessReview.updateMany({where:{id,manual_match:false},data:{match_type:staff_ids.length?'testo':null}});
    if(changed.count) {
      await tx.googleBusinessReviewStaff.deleteMany({where:{review_id:id}});
      if(staff_ids.length)await tx.googleBusinessReviewStaff.createMany({data:staff_ids.map(staff_id=>({review_id:id,staff_id}))});
    }
   }
   // Remove reviews no longer returned, only after every page has succeeded.
   await tx.googleBusinessReview.deleteMany({where:{location_name:parent,id:{notIn:[...reviews.keys()].map(id=>`${parent}/reviews/${id}`)}}});
  },{timeout:120000});
  console.info(JSON.stringify({service:'google-business',event:'sync',count:reviews.size,at:new Date().toISOString()}));
  return {count:reviews.size};
 }catch(error){
  const message=error instanceof z.ZodError?'Google ha restituito dati non validi.':'Sincronizzazione non riuscita. Verifica collegamento Google, accesso alle API e disponibilità del servizio.';
  // No response bodies, access tokens or reviewer data in logs.
  await prisma.googleBusinessConnection.updateMany({where:{id:'primary',lock_owner:owner},data:{sync_error:message.slice(0,300)}});
  console.error(JSON.stringify({service:'google-business',event:'sync_failed',at:new Date().toISOString()}));
  throw new Error(message);
 }finally{await prisma.googleBusinessConnection.updateMany({where:{id:'primary',lock_owner:owner},data:{lock_until:null,lock_owner:null}});}
}
export async function listReviews({from,to,cursor}:{from?:string;to?:string;cursor?:string}) {
 if(from&&to&&from>to)throw new Error('Intervallo non valido.');
 const connection=await prisma.googleBusinessConnection.findUnique({where:{id:'primary'},select:{location_name:true}});
 if(!connection?.location_name)throw new Error('Scheda Google non collegata.');
 const rows=await prisma.googleBusinessReview.findMany({where:{location_name:connection.location_name,...(cursor?{id:{gt:cursor}}:{}),...((from||to)?{created_at:{...(from?{gte:dayStart(from)}:{}),...(to?{lt:dayStart(addDays(to,1))}:{})}}:{})},orderBy:{id:'asc'},take:51,select:{id:true,rating:true,comment:true,reviewer_name:true,created_at:true,reply_text:true,match_type:true,staff:{select:{staff_id:true,staff:{select:{name:true}}},orderBy:{staff_id:'asc'}}}});
 return {reviews:rows.slice(0,50).map(r=>({id:r.id,rating:r.rating,comment:r.comment,reviewer_name:r.reviewer_name,created_at:romeIso(r.created_at),reply_text:r.reply_text,staff_ids:r.staff.map(s=>s.staff_id),staff_names:r.staff.map(s=>s.staff.name),match_type:r.match_type})),next_cursor:rows.length>50?rows[49].id:null};
}
export function reviewPeriods(now=new Date()) {
 const today=romeDate(now),weekday=new Date(`${today}T12:00:00Z`).getUTCDay();
 return {today,week:addDays(today,-((weekday+6)%7)),month:today.slice(0,7)+'-01',end:addDays(today,1)};
}
export async function reviewsSummary(now=new Date()) {
 const connection=await prisma.googleBusinessConnection.findUnique({where:{id:'primary'},select:{location_name:true,average_rating:true,total_reviews:true,synced_at:true}});
 if(!connection?.synced_at)throw new Error('Nessuna sincronizzazione Google completata.');
 const periods=reviewPeriods(now);
 const counts=await Promise.all(['today','week','month'].map(async key=>{
  const data=await prisma.googleBusinessReview.aggregate({where:{location_name:connection.location_name!,created_at:{gte:dayStart(periods[key as 'today'|'week'|'month']),lt:dayStart(periods.end)}},_count:true,_avg:{rating:true}});
  return {count:data._count,avg:data._avg.rating};
 }));
 return {average_rating:connection.average_rating,total_reviews:connection.total_reviews,today:counts[0],week:counts[1],month:counts[2],last_sync_at:romeIso(connection.synced_at)};
}
