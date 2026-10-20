import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireSuper, Permission, permissionKey, McpError } from '@/lib/mcp/permissions';
import { issuer, boundedBody, audit } from '@/lib/mcp/security';
import { z } from 'zod';
export async function POST(request:Request){
 const session=await auth();if(!session?.user?.id)return Response.json({error:'forbidden',message:'Accedi come super admin.'},{status:403});
 try{
  await requireSuper(session.user.id);
  if(request.headers.get('origin')!==issuer())return Response.json({error:'forbidden'},{status:403});
  const body=z.object({employee_id:z.string().min(1).max(100),permissions:Permission}).strict().parse(JSON.parse(await boundedBody(request)));
  if(body.employee_id===session.user.id&&body.permissions.role!=='super_admin')return Response.json({error:'Non puoi rimuovere il tuo accesso super admin.'},{status:400});
  if(!await prisma.user.findUnique({where:{id:body.employee_id}}))return Response.json({error:'Dipendente non trovato.'},{status:404});
  const key=permissionKey(body.employee_id);await prisma.setting.upsert({where:{key},create:{key,value:body.permissions},update:{value:body.permissions}});
  audit('permissions.updated',{user_id:session.user.id,employee_id:body.employee_id,role:body.permissions.role,status:200});
  return Response.json({ok:true});
 }catch(e){return Response.json({error:e instanceof McpError?e.message:'Configurazione non valida.'},{status:e instanceof McpError?403:400});}
}
