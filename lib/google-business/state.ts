import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
export async function consumeGoogleState(state:string,user_id:string) {
 if(!/^[A-Za-z0-9_-]{43}$/.test(state))return null;
 const hash=createHash('sha256').update(state).digest('hex');
 const pending=await prisma.googleBusinessOAuthState.findUnique({where:{hash}});
 if(!pending || pending.user_id!==user_id || pending.expires_at<new Date())return null;
 const consumed=await prisma.googleBusinessOAuthState.deleteMany({where:{hash,user_id}});
 return consumed.count===1?pending.verifier:null;
}
