import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prisma} from '../lib/prisma';
import {loadOffice} from '../lib/mcp/data';
import {syncCheck} from '../lib/mcp/sync';
import {allowedEmployees,requireEmployee,Permission} from '../lib/mcp/permissions';
import {Summary} from '../lib/mcp/schemas';
function patch(t:any,target:any,key:string,fn:any){const old=target[key];target[key]=fn;t.after(()=>target[key]=old);}
function fixture(t:any){
 const people=[{id:'new-hire',name:'Nuovo collaboratore',department_key:'saloni',mansione:'Parrucchiere',active:true,employee_status:'Attivo',mcp_excluded:false}];
 patch(t,prisma.setting,'findUnique',async()=>null); // New hires never need an MCP config entry.
 patch(t,prisma.user,'findMany',async({where}:any)=>people.filter(p=>(where.active===undefined||p.active===where.active)&&(!where.employee_status||p.employee_status!==where.employee_status.not)&&(where.mcp_excluded===undefined||p.mcp_excluded===where.mcp_excluded)&&(!where.department_key||where.department_key.in.includes(p.department_key))));
 patch(t,prisma.attendanceLog,'findMany',async()=>[{user_id:'new-hire',type:'IN',timestamp:new Date('2026-10-20T08:00:00Z')}]);
 patch(t,prisma.staffTask,'findMany',async()=>[]);
 return people;
}
const now=new Date('2026-10-20T10:00:00Z');
test('every active clocking employee appears in get_office_summary without manual configuration, including future hires',async t=>{
 const people=fixture(t);const office=await loadOffice(now);
 const result=Summary.parse({...office.meta,departments:office.departments,employees:office.employees,projects:office.projects});
 for(const p of people)assert.ok(result.employees.some(e=>e.id===p.id),`Active clocking employee missing: ${p.id}`);
 assert.equal(result.employees[0].department_key,'saloni');assert.deepEqual(await syncCheck(now),[]);
 const admin=Permission.parse({role:'super_admin'});assert.deepEqual(await allowedEmployees(admin),['new-hire']);
 people[0].active=false;assert.equal((await loadOffice(now)).employees.length,0);assert.deepEqual(await allowedEmployees(admin),[]);assert.deepEqual(await allowedEmployees(admin,true),['new-hire']);await requireEmployee(admin,'new-hire');
 people[0].active=true;people[0].employee_status='Ex dipendente';assert.equal((await loadOffice(now)).employees.length,0);
});
test('explicit opt-out applies to both connectors and sync_check reports the clocking omission',async t=>{
 const people=fixture(t);people[0].mcp_excluded=true;
 assert.equal((await loadOffice(now)).employees.length,0);
 const admin=Permission.parse({role:'super_admin'});assert.deepEqual(await allowedEmployees(admin,true),[]);await assert.rejects(()=>requireEmployee(admin,'new-hire'),/escluso/);
 assert.deepEqual((await syncCheck(now)).map(i=>i.reason),['excluded','attendance_not_shared']);
});
test('missing department or role is reported without silently hiding active staff; department permissions use live data',async t=>{
 const people=fixture(t);people[0].department_key='';people[0].mansione='';
 assert.equal((await loadOffice(now)).employees.length,1);assert.deepEqual((await syncCheck(now)).map(i=>i.reason),['missing_department','missing_role']);
 const manager=Permission.parse({role:'responsabile',departments:['saloni']});assert.deepEqual(await allowedEmployees(manager),[]);
 people[0].department_key='saloni';assert.deepEqual(await allowedEmployees(manager),['new-hire']);
 people[0].department_key='mkt';await assert.rejects(()=>requireEmployee(manager,'new-hire'),/reparti/);
});
