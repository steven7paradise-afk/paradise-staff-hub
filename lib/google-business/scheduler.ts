import { prisma } from '@/lib/prisma';
import { syncReviews } from './reviews';
const state=globalThis as typeof globalThis & {gbpTimer?:ReturnType<typeof setInterval>};
export function startGoogleBusinessScheduler() {
 if(state.gbpTimer || process.env.GBP_SYNC_ENABLED!=='true')return;
 let busy=false;
 const run=async()=>{
  if(busy)return;busy=true;
  try {
   const row=await prisma.googleBusinessConnection.findUnique({where:{id:'primary'},select:{location_name:true,attempted_at:true}});
   if(row?.location_name && (!row.attempted_at || Date.now()-row.attempted_at.getTime()>=15*60000))await syncReviews();
  }catch{console.error('Google Business: sincronizzazione non riuscita; nuovo tentativo nel ciclo successivo.');}
  finally{busy=false;}
 };
 state.gbpTimer=setInterval(()=>void run(),60000);state.gbpTimer.unref();void run();
}
