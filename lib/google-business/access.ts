import { auth } from '@/lib/auth';
import { requireSuper } from '@/lib/mcp/permissions';
import { issuer } from '@/lib/mcp/security';
export async function reviewsAdmin(request?:Request) {
 const session=await auth();
 if(!session?.user?.id)throw new Error('Accesso riservato ai super admin.');
 await requireSuper(session.user.id);
 if(request && request.method!=='GET' && request.headers.get('origin')!==issuer())throw new Error('Origine della richiesta non consentita.');
 return session.user.id;
}
export const privateJson=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
