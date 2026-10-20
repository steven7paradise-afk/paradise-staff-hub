import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {z} from 'zod';
async function fixture(){
 const state:any={tasks:new Map(),messages:new Map(),rooms:new Map(),notifications:[],pushes:[],blocked:false,permission:true};
 const actor='actor',employee='employee';
 const db:any={setting:{findUnique:async()=>null},user:{findUnique:async()=>({active:true,must_change_password:false,employee_status:'Attivo'}),findMany:async()=>[{id:employee,sede_id:'salon'}]},$executeRaw:async()=>{},staffTask:{findUnique:async({where}:any)=>state.tasks.get(where.id)||null,create:async({data}:any)=>{const t={...data,assignees:data.assignees.connect,created_at:new Date(),status:'NEW',completed_at:null};state.tasks.set(data.id,t);return t;}},chatRoom:{findUnique:async({where}:any)=>[...state.rooms.values()].find((r:any)=>r.id===where.id||r.directKey===where.directKey)||null,upsert:async({create}:any)=>{let r=[...state.rooms.values()].find((r:any)=>r.directKey===create.directKey);if(!r){r={...create,id:'room',members:create.members.create,archived:false};state.rooms.set('room',r);}return r;},update:async()=>{}},chatMessage:{findUnique:async({where}:any)=>state.messages.get(where.userId_clientId.clientId)||null,count:async()=>0,create:async({data}:any)=>{const m={...data,id:'message',createdAt:new Date()};state.messages.set(data.clientId,m);return m;}}};
 // Serialize transactions to model the PostgreSQL advisory lock used by production.
 let queue=Promise.resolve();db.$transaction=(fn:any)=>{const next=queue.then(()=>fn(db));queue=next.catch(()=>{});return next;};
 (globalThis as any).__actions={db,state};
 const result=await build({entryPoints:['lib/mcp/actions.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'fixtures',setup(b){
  b.onResolve({filter:/^(?:@\/lib\/(?:prisma|notifications|chat-push|chat-safety)|\.\/permissions)$/},a=>({path:a.path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path.endsWith('prisma')?'export const prisma=globalThis.__actions.db':a.path.endsWith('notifications')?'export async function createNotification(n){globalThis.__actions.state.notifications.push(n)}':a.path.endsWith('chat-push')?'export function scheduleChatPush(id){globalThis.__actions.state.pushes.push(id)}':a.path.endsWith('chat-safety')?'export async function requireContactAllowed(){if(globalThis.__actions.state.blocked)throw Error("blocked")} export async function blockedPeers(){return []} export function screenChatText(){}':'export class McpError extends Error{constructor(code,message){super(message);this.code=code}} export function forbidden(m){throw new McpError("forbidden",m)} export async function requireEmployee(){} export async function allowedEmployees(){return null} export async function requireTask(p,id){if(!globalThis.__actions.state.permission)forbidden("revoked");return globalThis.__actions.db.staffTask.findUnique({where:{id}})}',loader:'js'}));
 }}]});const mod={exports:{} as any};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
 const tools:any={};mod.exports.registerActions((name:string,description:string,input:any,output:any,run:any,write:boolean)=>{tools[name]={input:z.object(input),output:z.object(output),run,write}},actor);
 return {state,tools,call:async(name:string,a:any)=>tools[name].output.parse(await tools[name].run(tools[name].input.parse(a),{role:'super_admin'}))};
}
test('concurrent task retries create one task, assigned_by actor, one notification; revoked retries deny',async()=>{
 const {state,call}=await fixture();const a={title:'Test',description:'Description',priority:'ALTA',assignee_ids:['employee'],client_request_id:'request'};
 const [one,two]=await Promise.all([call('create_task',a),call('create_task',a)]);assert.equal(one.task.id,two.task.id);assert.equal(one.task.assigned_by,'actor');assert.equal(state.tasks.size,1);assert.equal(state.notifications.length,1);
 state.permission=false;await assert.rejects(()=>call('create_task',a),/revoked/);
 await assert.rejects(()=>call('create_task',{...a,title:'x'.repeat(201)}));await assert.rejects(()=>call('create_task',{...a,description:'x'.repeat(4001)}));await assert.rejects(()=>call('create_task',{...a,assignee_ids:['employee','employee']}));
});
test('chat retries send once and push once; blocked contacts and idempotency cross-recipient reuse fail',async()=>{
 const {state,call}=await fixture();const a={employee_id:'employee',text:'Test message',client_request_id:'request'};
 const [one,two]=await Promise.all([call('send_message',a),call('send_message',a)]);assert.equal(one.message.id,two.message.id);assert.equal(state.messages.size,1);assert.equal(state.pushes.length,1);
 await assert.rejects(()=>call('send_message',{...a,employee_id:'other'}),/client_request_id/);
 state.blocked=true;await assert.rejects(()=>call('send_message',a),/blocked/);
 state.blocked=false;state.rooms.get('room').members=[{userId:'outsider'},{userId:'employee'}];await assert.rejects(()=>call('send_message',a),/accessibile/);
});
