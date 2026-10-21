import { consumeGoogleState } from '@/lib/google-business/state';
import { prisma } from '@/lib/prisma';
import { reviewsAdmin } from '@/lib/google-business/access';
import { callbackUrl, tokenRequest, seal, GBP_SCOPE, verifyBusinessAccount } from '@/lib/google-business/oauth';
import { issuer } from '@/lib/mcp/security';
export async function GET(request:Request) {
 const redirect=(status:string)=>Response.redirect(`${issuer()}/reviews?google=${status}`,303);
 try {
  const user_id=await reviewsAdmin();const url=new URL(request.url),state=url.searchParams.get('state') || '';
  const verifier=await consumeGoogleState(state,user_id);
  if(!verifier)return redirect('invalid_state');
  const code=url.searchParams.get('code');if(!code||url.searchParams.has('error'))return redirect('denied');
  const tokens=await tokenRequest({grant_type:'authorization_code',code,code_verifier:verifier,redirect_uri:callbackUrl()});
  if(!tokens.refresh_token || !tokens.scope?.split(' ').includes(GBP_SCOPE))return redirect('missing_scope');
  try{await verifyBusinessAccount(tokens.access_token);}catch{return redirect('wrong_account');}
  const tokens_encrypted=seal({refresh_token:tokens.refresh_token});
  // A different Google account requires choosing and verifying the location again.
  await prisma.googleBusinessConnection.upsert({where:{id:'primary'},create:{id:'primary',tokens_encrypted},update:{tokens_encrypted,location_name:null,location_title:null,synced_at:null,average_rating:null,total_reviews:null,lock_owner:null,lock_until:null}});
  console.info(JSON.stringify({service:'google-business',event:'connected',user_id,at:new Date().toISOString()}));
  return redirect('connected');
 }catch{return redirect('failed');}
}
