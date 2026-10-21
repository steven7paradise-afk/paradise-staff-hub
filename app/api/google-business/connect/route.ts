import { randomBytes, createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { reviewsAdmin, privateJson } from '@/lib/google-business/access';
import { configuration, callbackUrl, GBP_SCOPE, GBP_IDENTITY_SCOPE } from '@/lib/google-business/oauth';
export async function POST(request:Request) {
 let user_id:string;try{user_id=await reviewsAdmin(request);}catch{return privateJson({error:'Accesso riservato ai super admin.'},403);}
 try {
  const {id,email}=configuration();
  const state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
  await prisma.googleBusinessOAuthState.deleteMany({where:{expires_at:{lt:new Date()}}});
  await prisma.googleBusinessOAuthState.create({data:{hash:createHash('sha256').update(state).digest('hex'),user_id,verifier,expires_at:new Date(Date.now()+10*60000)}});
  const query=new URLSearchParams({client_id:id,redirect_uri:callbackUrl(),response_type:'code',scope:`${GBP_SCOPE} ${GBP_IDENTITY_SCOPE}`,login_hint:email,access_type:'offline',prompt:'consent select_account',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${query}`,303);
 }catch{return privateJson({error:'Configura le credenziali Google Business Profile e la chiave di cifratura sul server.'},503);}
}
