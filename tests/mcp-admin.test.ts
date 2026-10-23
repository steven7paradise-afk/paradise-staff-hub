import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WebStandardStreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {createAdminServer} from '../lib/mcp/admin';
import {prisma} from '../lib/prisma';
import {bearerIdentity} from '../lib/mcp/oauth';
import {adminResource,resource,ADMIN_SCOPE,MCP_SCOPE} from '../lib/mcp/security';
async function rpc(method:string,params:object={}){const server=createAdminServer({user_id:'admin',client_id:'test'});const transport=new WebStandardStreamableHTTPServerTransport({enableJsonResponse:true});try{await server.connect(transport);const r=await transport.handleRequest(new Request('https://test/mcp-admin',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}));return await r.json();}finally{await server.close();}}
function patch(t:any,target:any,key:string,fn:any){const old=target[key];target[key]=fn;t.after(()=>target[key]=old);}
test('admin tools enforce roles, explicit projections, schemas and private PDF links',async t=>{
 patch(t,prisma.user,'findMany',async()=>[{id:'person'}]);
 let role='SUPER_ADMIN';patch(t,prisma.user,'findUnique',async()=>({id:'admin',active:true,role}));
 patch(t,prisma.user,'findUniqueOrThrow',async()=>({id:'person',name:'Test',active:true,employee_status:'Attivo',mansione:'Staff',department_key:'saloni',contract_start:null,contract_end:null,workforce_data:{employmentType:'Indeterminato',contractLevel:'3',personalEmail:'PRIVATE_SENTINEL',residenceAddress:'PRIVATE_SENTINEL'}}));
 patch(t,prisma.setting,'findUnique',async()=>null);
 patch(t,prisma.attendanceLog,'findMany',async(a:any)=>{assert.equal(a.select.note,undefined);assert.equal(a.select.ip_address,undefined);return []});
 patch(t,prisma.leaveRequest,'findMany',async(a:any)=>{for(const k of ['reason','medical_code','admin_note'])assert.equal(a.select[k],undefined);return []});
 patch(t,prisma.scheduleEntry,'findMany',async()=>[]);
 patch(t,prisma.document,'findMany',async(a:any)=>{for(const k of ['file_url','storage_path','notes'])assert.equal(a.select[k],undefined);return [{id:'doc',month:10,year:2026}]});
 patch(t,prisma.staffTask,'findMany',async()=>[]);
 const list=await rpc('tools/list');assert.equal(list.result.tools.length,18);for(const tool of list.result.tools){assert.equal(tool.annotations.readOnlyHint,!["create_task","update_task","add_task_comment","send_message","mark_read"].includes(tool.name));assert.ok(tool.outputSchema);}
 for(const name of ['get_full_profile','get_attendance_history','list_absences','list_payslips','list_all_tasks']){
 const result=await rpc('tools/call',{name,arguments:{employee_id:'person',...(['get_attendance_history','list_absences'].includes(name)?{from:'2026-10-01',to:'2026-10-20'}:{})}});assert.equal(result.result.isError,undefined,JSON.stringify(result));assert.equal(JSON.stringify(result).includes('PRIVATE_SENTINEL'),false);assert.deepEqual(JSON.parse(result.result.content[0].text),result.result.structuredContent);
 if(name==='list_payslips'){assert.match(result.result.structuredContent.payslips[0].pdf_url,/\/api\/documents\/doc\/download$/);assert.equal(result.result.structuredContent.payslips[0].net,null);}
 }
 const invalid=await rpc('tools/call',{name:'get_attendance_history',arguments:{employee_id:'person',from:'2024-01-01',to:'2026-10-20'}});assert.equal(invalid.result.isError,true);
 role='DIPENDENTE';const denied=await rpc('tools/call',{name:'get_full_profile',arguments:{employee_id:'person'}});assert.equal(denied.result.isError,true);
});
test('operational OAuth grants cannot access admin resource, including after role elevation',async t=>{
 patch(t,prisma.setting,'findUnique',async()=>null);
 patch(t,prisma.user,'findUnique',async()=>({id:'admin',active:true,role:'SUPER_ADMIN'}));
 const grant={user_id:'admin',client_id:'client',resource:resource(),scope:MCP_SCOPE,expires_at:new Date(Date.now()+60000),revoked_at:null};
 patch(t,prisma.mcpToken,'findUnique',async()=>({access_hash:'hash',access_expires_at:new Date(Date.now()+60000),grant}));
 const req=new Request('https://test',{headers:{Authorization:'Bearer '+'a'.repeat(43)}});
 assert.equal(await bearerIdentity(req,adminResource()),null);
 grant.resource=adminResource();grant.scope=ADMIN_SCOPE;assert.ok(await bearerIdentity(req,adminResource()));assert.equal(await bearerIdentity(req,resource()),null);
});
test('admin endpoint always requires OAuth even when secret URL is enabled',async t=>{
 const {POST}=await import('../app/mcp-admin/route');process.env.MCP_ENABLED='true';process.env.MCP_URL_TOKEN='s'.repeat(64);t.after(()=>delete process.env.MCP_URL_TOKEN);
 const r=await POST(new Request(adminResource(),{method:'POST',headers:{Authorization:'Bearer '+'s'.repeat(64)}}));assert.equal(r.status,401);assert.match(r.headers.get('www-authenticate')!,/oauth-protected-resource\/mcp-admin/);assert.match(r.headers.get('www-authenticate')!,/staff:admin/);
});

test('schedule tools return daily rests, shift times and enforce department/category permissions', async t => {
 let categories = ['assenze', 'presenze'];
 patch(t, prisma.user, 'findUnique', async () => ({active:true,role:'RESPONSABILE'}));
 patch(t, prisma.setting, 'findUnique', async () => ({value:{role:'responsabile',departments:['saloni'],categories,create_tasks:false,chat:false}}));
 patch(t, prisma.user, 'findMany', async (a:any) => {
   assert.deepEqual(a.where.department_key,{in:['saloni']});
   assert.equal(a.where.mcp_excluded,false);
   return [{id:'salon-worker'}];
 });
 patch(t, prisma.leaveRequest, 'findMany', async () => []);
 let queries=0;
 patch(t, prisma.scheduleEntry, 'findMany', async (a:any) => {
   queries++;
   assert.deepEqual(a.where.user_id,{in:['salon-worker']});
   assert.equal(a.where.date.gte.toISOString(),'2026-10-25T00:00:00.000Z');
   assert.equal(a.where.date.lt.toISOString(),'2026-10-27T00:00:00.000Z');
   assert.equal(a.select.note,undefined);
   const row={user_id:'salon-worker',date:new Date('2026-10-25T00:00:00Z'),start_time:null,end_time:null};
   return [
     {...row,id:'rest',category:{name:'Riposo',code:'R3',start_time:'09:00',end_time:'18:00'}},
     {...row,id:'shift',date:new Date('2026-10-26T00:00:00Z'),start_time:'10:00',category:{name:'Mattina',code:'T',start_time:'09:00',end_time:'18:00'}},
     {...row,id:'leave',category:{name:'Malattia',code:'M',start_time:'09:00',end_time:'18:00'}},
   ];
 });
 const args={from:'2026-10-25',to:'2026-10-26'};
 const absences=await rpc('tools/call',{name:'list_absences',arguments:{...args,employee_id:'salon-worker'}});
 assert.deepEqual(absences.result.structuredContent.absences,[{id:'schedule:rest',type:'RIPOSO',from:'2026-10-25',to:'2026-10-25',days:1,status:'APPROVED'}]);
 const shifts=await rpc('tools/call',{name:'list_shifts',arguments:args});
 assert.deepEqual(shifts.result.structuredContent.shifts,[
   {employee_id:'salon-worker',date:'2026-10-25',type:'RIPOSO',start_time:null,end_time:null},
   {employee_id:'salon-worker',date:'2026-10-26',type:'TURNO',start_time:'10:00',end_time:'18:00'},
 ]);
 assert.deepEqual(JSON.parse(shifts.result.content[0].text),shifts.result.structuredContent);
 const denied=await rpc('tools/call',{name:'list_shifts',arguments:{...args,employee_id:'outside'}});
 assert.equal(JSON.parse(denied.result.content[0].text).error,'forbidden');
 categories=['assenze'];
 const noCategory=await rpc('tools/call',{name:'list_shifts',arguments:args});
 assert.equal(JSON.parse(noCategory.result.content[0].text).error,'forbidden');
 assert.equal(queries,2);
});

test('review tools deny non-super-admin access and expose only declared review fields',async t=>{
 let role='RESPONSABILE';patch(t,prisma.user,'findUnique',async()=>({active:true,role}));
 patch(t,prisma.setting,'findUnique',async()=>null);
 patch(t,prisma.googleBusinessConnection,'findUnique',async()=>({location_name:'accounts/1/locations/2',synced_at:new Date(),average_rating:4.5,total_reviews:20}));
 patch(t,prisma.googleBusinessReview,'findMany',async()=>[{id:'review',rating:5,comment:'Pubblico',reviewer_name:'Google User',created_at:new Date(),reply_text:null,staff:[],match_type:null,private:'PRIVATE_SENTINEL'}]);
 patch(t,prisma.googleBusinessReview,'aggregate',async()=>({_count:0,_avg:{rating:null}}));
 for(const name of ['list_reviews','get_reviews_summary']) {
  const denied=await rpc('tools/call',{name,arguments:{}});assert.equal(JSON.parse(denied.result.content[0].text).error,'forbidden');
 }
 role='SUPER_ADMIN';
 for(const name of ['list_reviews','get_reviews_summary']) {
  const result=await rpc('tools/call',{name,arguments:{}});assert.equal(result.result.isError,undefined);
  assert.equal(JSON.stringify(result).includes('PRIVATE_SENTINEL'),false);
  assert.deepEqual(JSON.parse(result.result.content[0].text),result.result.structuredContent);
 }
});
