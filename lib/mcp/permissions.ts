import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { activeSharedWhere } from './data';
export const Permission = z.object({role:z.enum(['super_admin','responsabile','collaboratore']),departments:z.array(z.enum(['ecom','mkt','admin','ceo','tit','mag','sarta','saloni'])).default([]),categories:z.array(z.enum(['presenze','task','assenze','buste_paga','contratto'])).default([]),create_tasks:z.boolean().default(false),chat:z.boolean().default(false)}).strict();
export type Access = z.infer<typeof Permission>;
export const permissionKey=(id:string)=>`mcp-permissions:${id}`;
export class McpError extends Error { constructor(public code:string,message:string){super(message);} }
export const forbidden=(message='Non hai il permesso di consultare questi dati o eseguire questa azione.'):never=>{throw new McpError('forbidden',message);};
export async function accessFor(id:string):Promise<Access|null>{
 const user=await prisma.user.findUnique({where:{id},select:{active:true,role:true}});if(!user?.active)return null;
 const saved=await prisma.setting.findUnique({where:{key:permissionKey(id)}});
 if(saved){const parsed=Permission.safeParse(saved.value);return parsed.success?parsed.data:null;}
 return Permission.parse({role:['ZERO','SUPER_ADMIN'].includes(user.role)?'super_admin':['ADMIN','RESPONSABILE'].includes(user.role)?'responsabile':'collaboratore'});
}
export async function requireSuper(id:string){const p=await accessFor(id);if(p?.role!=='super_admin')forbidden('Solo un super admin può gestire i permessi.');return p!;}
export async function allowedEmployees(p:Access, history=false):Promise<string[]> {
 const users=await prisma.user.findMany({where:{...(history?{mcp_excluded:false}:activeSharedWhere),...(p.role==='super_admin'?{}:{department_key:{in:p.departments}})},select:{id:true}});
 return users.map(u=>u.id);
}
export async function requireEmployee(p:Access,id:string,history=true){const ids=await allowedEmployees(p,history);if(!ids.includes(id))forbidden('Dipendente escluso dai connettori o fuori dai reparti autorizzati.');}
const categories:Record<string,Access['categories'][number]>={get_full_profile:'contratto',get_attendance_history:'presenze',list_absences:'assenze',list_shifts:'presenze',list_payslips:'buste_paga',list_all_tasks:'task',create_task:'task',update_task:'task',add_task_comment:'task'};
export async function authorizeTool(id:string,name:string,args:Record<string,unknown>){
 const p=await accessFor(id);if(!p||p.role==='collaboratore')forbidden('Il tuo ruolo non può usare il connettore amministratore.');
 if(p!.role!=='super_admin'){
  if(['sync_check','list_reviews','get_reviews_summary','list_inventory','list_inventory_movements'].includes(name))forbidden('Questo strumento è riservato ai super admin.');
  const category=categories[name];if(category&&!p!.categories.includes(category))forbidden(`Categoria non autorizzata: ${category}.`);
  if(['create_task','update_task','add_task_comment'].includes(name)&&!p!.create_tasks)forbidden('Scrittura delle task non autorizzata.');
  if(['list_conversations','list_messages','send_message','mark_read'].includes(name)&&!p!.chat)forbidden('Accesso alla chat non autorizzato.');
 }
 if(typeof args.employee_id==='string')await requireEmployee(p!,args.employee_id,!['send_message','mark_read'].includes(name));
 if(Array.isArray(args.assignee_ids))for(const employee of args.assignee_ids)await requireEmployee(p!,String(employee),false);
 return p!;
}
export async function requireTask(p:Access,id:string){const task=await prisma.staffTask.findUnique({where:{id},include:{assignees:{select:{id:true}}}});if(!task)throw new McpError('not_found','Task non trovata.');const ids=await allowedEmployees(p);if(ids&&(!task.assignees.length||task.assignees.some(a=>!ids.includes(a.id))))forbidden('La task coinvolge persone fuori dai reparti autorizzati.');return task;}
