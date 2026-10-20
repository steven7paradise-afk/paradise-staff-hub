import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prisma} from '../lib/prisma';
import {accessFor,authorizeTool,requireTask,allowedEmployees,Permission,permissionKey} from '../lib/mcp/permissions';
function patch(t:any,target:any,key:string,fn:any){const old=target[key];target[key]=fn;t.after(()=>target[key]=old);}
test('live permissions deny by default, enforce categories and department boundaries including mixed tasks',async t=>{
 let role='RESPONSABILE',active=true,saved:any=null;
 patch(t,prisma.user,'findUnique',async()=>({role,active,id:'actor'}));
 patch(t,prisma.setting,'findUnique',async({where}:any)=>where.key===permissionKey('actor')?(saved?{value:saved}:null):{value:{employees:[{employee_id:'inside',department_key:'ecom',is_department_lead:false},{employee_id:'outside',department_key:'mkt',is_department_lead:false}],departments:[],task_texts:[]}});
 assert.equal((await accessFor('actor'))?.role,'responsabile');
 await assert.rejects(()=>authorizeTool('actor','list_all_tasks',{}),/Categoria/);
 saved=Permission.parse({role:'responsabile',departments:['ecom'],categories:['task'],create_tasks:true});
 // officeConfig validates its persisted schema; use its actual shape below.
 const {CONFIG_KEY,OfficeConfig}=await import('../lib/mcp/schemas');
 const config=OfficeConfig.parse({employees:[{employee_id:'inside',department_key:'ecom',public_role:'Staff'},{employee_id:'outside',department_key:'mkt',public_role:'Staff'}],departments:[],task_texts:[]});
 patch(t,prisma.setting,'findUnique',async({where}:any)=>where.key===permissionKey('actor')?{value:saved}:where.key===CONFIG_KEY?{value:config}:null);
 const p=await authorizeTool('actor','create_task',{assignee_ids:['inside']});assert.deepEqual(await allowedEmployees(p),['inside']);
 await assert.rejects(()=>authorizeTool('actor','create_task',{assignee_ids:['outside']}),/reparti/);
 await assert.rejects(()=>authorizeTool('actor','send_message',{employee_id:'inside'}),/chat/);
 patch(t,prisma.staffTask,'findUnique',async()=>({id:'task',assignees:[{id:'inside'},{id:'outside'}]}));
 await assert.rejects(()=>requireTask(p,'task'),/fuori/);
 saved.create_tasks=false;await assert.rejects(()=>authorizeTool('actor','update_task',{task_id:'task'}),/Scrittura/);
 saved.role='collaboratore';await assert.rejects(()=>authorizeTool('actor','list_all_tasks',{}),/ruolo/);
 saved=null;role='SUPER_ADMIN';patch(t,prisma.setting,'findUnique',async()=>null);assert.equal((await accessFor('actor'))?.role,'super_admin');
 active=false;assert.equal(await accessFor('actor'),null);
});
