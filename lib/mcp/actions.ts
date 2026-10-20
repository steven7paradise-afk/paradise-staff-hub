import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { scheduleChatPush } from '@/lib/chat-push';
import { requireContactAllowed, blockedPeers, screenChatText } from '@/lib/chat-safety';
import { allowedEmployees, requireEmployee, requireTask, McpError, forbidden, type Access } from './permissions';
import { digest, audit } from './security';
import { DateKey, TaskStatus } from './schemas';
import { dayStart, romeDate, romeIso } from './time';
import { taskState } from './data';
const Id=z.string().trim().min(1).max(100),Text=z.string().trim().min(1).max(4000),Priority=z.enum(['ALTA','MEDIA','BASSA']);
const requestId=z.string().trim().min(1).max(128);
export const taskSchema=z.object({id:Id,title:z.string(),description:z.string(),status:z.string(),priority:z.string(),created_at:z.string(),due_date:z.string().nullable(),completed_at:z.string().nullable(),assigned_by:Id,assignee_ids:z.array(Id)});
export const taskSelect={id:true,title:true,description:true,status:true,priority:true,created_at:true,due_date:true,completed_at:true,created_by_id:true,assignees:{select:{id:true}}} as const;
export function taskResult(r:any){return {id:r.id,title:r.title,description:r.description,status:taskState(r.status),priority:r.priority,created_at:romeIso(r.created_at),due_date:r.due_date?romeDate(r.due_date):null,completed_at:r.completed_at?romeIso(r.completed_at):null,assigned_by:r.created_by_id,assignee_ids:r.assignees.map((a:{id:string})=>a.id)};}
export type Register=(name:string,description:string,input:z.ZodRawShape,output:z.ZodRawShape,run:(args:any,access:Access)=>Promise<any>,write?:boolean)=>void;
async function notify(user_id:string,title:string,message:string,task:string){try{await createNotification({user_id,title,message,type:'TASK',action_url:`/tasks?task=${encodeURIComponent(task)}`,read:false});}catch{audit('admin.notification_failed',{employee_id:user_id,status:500});}}
export function registerActions(tool:Register,actor:string){
 tool('create_task','Crea una task e notifica gli assegnatari. Riutilizza client_request_id per riprovare senza duplicare.',{title:z.string().trim().min(1).max(200),description:z.string().trim().max(4000),assignee_ids:z.array(Id).min(1).max(100).refine(a=>new Set(a).size===a.length),priority:Priority,due_date:DateKey.optional(),client_request_id:requestId},{task:taskSchema},async(a,p)=>{
  const id=`mcp-${digest(JSON.stringify([actor,a.client_request_id]))}`;
  const result=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
   const old=await tx.staffTask.findUnique({where:{id},select:taskSelect});if(old){await requireTask(p,id);return {task:old,created:false};}
   const people=await tx.user.findMany({where:{id:{in:a.assignee_ids},active:true,employee_status:{not:'Ex dipendente'}},select:{id:true,sede_id:true}});
   if(people.length!==a.assignee_ids.length)throw new McpError('invalid_arguments','Seleziona collaboratori esistenti e attivi.');
   const location=people.find(u=>u.sede_id)?.sede_id;if(!location)throw new McpError('invalid_arguments','Assegna una sede ai collaboratori prima di creare la task.');
   const task=await tx.staffTask.create({data:{id,title:a.title,description:a.description,priority:a.priority,category:'Operativa',created_by_id:actor,location_id:location,due_date:a.due_date?dayStart(a.due_date):null,assignees:{connect:a.assignee_ids.map((id:string)=>({id}))}},select:taskSelect});return {task,created:true};
  });
  if(result.created)await Promise.all(result.task.assignees.map(u=>notify(u.id,`Nuova task: ${result.task.title}`,result.task.description,id)));
  return {task:taskResult(result.task)};
 },true);
 tool('update_task','Modifica una task autorizzata. due_date null rimuove la scadenza.',{task_id:Id,status:TaskStatus.optional(),priority:Priority.optional(),due_date:DateKey.nullable().optional(),title:z.string().trim().min(1).max(200).optional(),description:z.string().trim().max(4000).optional()},{task:taskSchema},async(a,p)=>{
  const old=await requireTask(p,a.task_id);const {task_id,status,due_date,...data}=a;
  const task=await prisma.staffTask.update({where:{id:task_id},data:{...data,...(due_date!==undefined?{due_date:due_date?dayStart(due_date):null}:{}),...(status?{status:({da_fare:'NEW',in_corso:'ACTIVE',completata:'COMPLETED'} as Record<string,string>)[status],completed_at:status==='completata'?old.completed_at||new Date():null,...(status==='in_corso'&&!old.started_at?{started_at:new Date()}:{} )}:{})},select:taskSelect});
  return {task:taskResult(task)};
 },true);
 tool('add_task_comment','Aggiunge un commento alla task e notifica gli altri partecipanti.',{task_id:Id,text:Text},{comment:z.object({id:Id,task_id:Id,from:Id,text:z.string(),sent_at:z.string()})},async(a,p)=>{
  const task=await requireTask(p,a.task_id);const c=await prisma.staffTaskComment.create({data:{task_id:a.task_id,user_id:actor,message:a.text}});
  await Promise.all([...new Set([...task.assignees.map(u=>u.id),task.created_by_id])].filter(id=>id!==actor).map(id=>notify(id,`Nuovo commento: ${task.title}`,a.text,task.id)));
  return {comment:{id:c.id,task_id:c.task_id,from:actor,text:c.message,sent_at:romeIso(c.created_at)}};
 },true);
 async function chatAccess(){
  if(process.env.INTERNAL_CHAT_ENABLED==='false')forbidden('La chat non è attiva.');
  const u=await prisma.user.findUnique({where:{id:actor},select:{active:true,must_change_password:true,employee_status:true}});
  if(!u?.active||u.must_change_password||u.employee_status==='Ex dipendente'||await prisma.setting.findUnique({where:{key:`chat-suspended:${actor}`}}))forbidden('Accesso alla chat sospeso o password da aggiornare.');
 }
 async function direct(employee:string,p:Access){await chatAccess();await requireEmployee(p,employee);if(employee===actor)throw new McpError('invalid_arguments','Scegli un altro collaboratore.');await requireContactAllowed(actor,employee);return prisma.chatRoom.findUnique({where:{directKey:JSON.stringify([actor,employee].sort())},include:{members:true}});}
 function memberCheck(room:any){if(room&&(room.archived||room.kind!=='direct'||room.members.length!==2||!room.members.some((m:any)=>m.userId===actor)))forbidden('Conversazione non accessibile.');}
 const messageSchema=z.object({id:Id,from:Id,text:z.string(),sent_at:z.string(),read_at:z.string().nullable()});
 const message=(m:any,read:Date|null)=>({id:m.id,from:m.userId,text:m.body,sent_at:romeIso(m.createdAt),read_at:read&&read>=m.createdAt?romeIso(read):null});
 tool('list_conversations','Elenca le tue conversazioni dirette autorizzate, ultimo messaggio e non letti. Non accede alle chat di altri utenti.',{}, {conversations:z.array(z.object({employee_id:Id,last_message:messageSchema.nullable(),unread_count:z.number()}))},async(_,p)=>{
  await chatAccess();const ids=await allowedEmployees(p),blocked=await blockedPeers(actor);
  const rooms=await prisma.chatRoom.findMany({where:{kind:'direct',archived:false,members:{some:{userId:actor}}},include:{members:true,messages:{where:{deletedAt:null},orderBy:[{createdAt:'desc'},{id:'desc'}],take:1}}});
  const conversations=[];for(const r of rooms){const peer=r.members.find(m=>m.userId!==actor);if(r.members.length!==2||!peer||blocked.includes(peer.userId)||(ids&&!ids.includes(peer.userId)))continue;const own=r.members.find(m=>m.userId===actor)!;const last=r.messages[0];const unread_count=await prisma.chatMessage.count({where:{roomId:r.id,userId:peer.userId,deletedAt:null,createdAt:{gt:own.lastReadAt}}});conversations.push({employee_id:peer.userId,last_message:last?message(last,last.userId===actor?peer.lastReadAt:own.lastReadAt):null,unread_count});}
  return {conversations};
 });
 tool('list_messages','Messaggi della tua chat diretta in ordine cronologico, 50 per pagina. cursor è l’ultimo id ricevuto; read_at è l’ultima lettura della conversazione che include il messaggio.',{employee_id:Id,since:z.iso.datetime({offset:true}).optional(),cursor:Id.optional()},{messages:z.array(messageSchema),next_cursor:Id.nullable()},async(a,p)=>{
  const r=await direct(a.employee_id,p);memberCheck(r);if(!r)return {messages:[],next_cursor:null};
  const cursor=a.cursor?await prisma.chatMessage.findFirst({where:{id:a.cursor,roomId:r.id,deletedAt:null}}):null;if(a.cursor&&!cursor)throw new McpError('invalid_arguments','Cursore non valido per questa conversazione.');
  const rows=await prisma.chatMessage.findMany({where:{roomId:r.id,deletedAt:null,...(a.since?{createdAt:{gt:new Date(a.since)}}:{}),...(cursor?{OR:[{createdAt:{gt:cursor.createdAt}},{createdAt:cursor.createdAt,id:{gt:cursor.id}}]}:{})},orderBy:[{createdAt:'asc'},{id:'asc'}],take:51});
  return {messages:rows.slice(0,50).map(m=>message(m,r.members.find(x=>x.userId!==m.userId)?.lastReadAt||null)),next_cursor:rows.length>50?rows[49].id:null};
 });
 tool('send_message','Invia un messaggio nella tua chat diretta e notifica il collaboratore. client_request_id evita duplicati.',{employee_id:Id,text:Text,client_request_id:requestId},{message:messageSchema},async(a,p)=>{
  const r=await direct(a.employee_id,p);memberCheck(r);screenChatText(a.text);
  const peer=await prisma.user.findUnique({where:{id:a.employee_id},select:{active:true,employee_status:true}});if(!peer?.active||peer.employee_status==='Ex dipendente')forbidden('Il destinatario non è attivo.');
  const clientId=`mcp-${digest(a.client_request_id)}`;
  const result=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor}))`;
   const old=await tx.chatMessage.findUnique({where:{userId_clientId:{userId:actor,clientId}}});
   if(old){const oldRoom=await tx.chatRoom.findUnique({where:{id:old.roomId},include:{members:true}});memberCheck(oldRoom);if(!oldRoom||oldRoom.directKey!==JSON.stringify([actor,a.employee_id].sort())||old.deletedAt)throw new McpError('conflict','client_request_id già usato per un altro invio.');return {message:old,created:false};}
   if(await tx.chatMessage.count({where:{userId:actor,createdAt:{gte:new Date(Date.now()-60000)}}})>=30)throw new McpError('rate_limited','Troppi messaggi. Riprova tra un minuto.');
   const room=await tx.chatRoom.upsert({where:{directKey:JSON.stringify([actor,a.employee_id].sort())},create:{title:'Chat privata',kind:'direct',directKey:JSON.stringify([actor,a.employee_id].sort()),members:{create:[{userId:actor},{userId:a.employee_id}]}},update:{},include:{members:true}});memberCheck(room);
   const m=await tx.chatMessage.create({data:{roomId:room.id,userId:actor,clientId,body:a.text}});await tx.chatRoom.update({where:{id:room.id},data:{updatedAt:m.createdAt}});return {message:m,created:true};
  });if(result.created)scheduleChatPush(result.message.id);return {message:message(result.message,null)};
 },true);
 tool('mark_read','Segna come letti i messaggi attualmente presenti nella tua chat diretta.',{employee_id:Id},{read_at:z.string().nullable()},async(a,p)=>{
  const r=await direct(a.employee_id,p);memberCheck(r);if(!r)return {read_at:null};const latest=await prisma.chatMessage.findFirst({where:{roomId:r.id,deletedAt:null},orderBy:[{createdAt:'desc'},{id:'desc'}]});if(!latest)return {read_at:null};await prisma.chatMember.updateMany({where:{roomId:r.id,userId:actor,lastReadAt:{lt:latest.createdAt}},data:{lastReadAt:latest.createdAt}});return {read_at:romeIso(latest.createdAt)};
 },true);
}
