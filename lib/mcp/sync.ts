import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { DepartmentKey } from './schemas';
import { loadOffice } from './data';
import { addDays, dayStart, romeDate } from './time';
export const SyncIssue = z.object({employee_id:z.string(),name:z.string(),reason:z.enum(['excluded','missing_department','missing_role','attendance_not_shared'])});
export async function syncCheck(now=new Date()) {
 const date=romeDate(now);
 const [people,logs,office]=await Promise.all([
  prisma.user.findMany({where:{active:true,employee_status:{not:'Ex dipendente'}},select:{id:true,name:true,department_key:true,mansione:true,mcp_excluded:true}}),
  prisma.attendanceLog.findMany({where:{timestamp:{gte:dayStart(date),lt:dayStart(addDays(date,1))}},select:{user_id:true},distinct:['user_id']}),
  loadOffice(now),
 ]);
 const shared=new Set(office.employees.map(e=>e.id)),clocked=new Set(logs.map(l=>l.user_id));
 return people.flatMap(p=>{
  const reasons:z.infer<typeof SyncIssue>['reason'][]=[];
  if(p.mcp_excluded)reasons.push('excluded');
  if(!DepartmentKey.safeParse(p.department_key).success)reasons.push('missing_department');
  if(!p.mansione?.trim())reasons.push('missing_role');
  if(clocked.has(p.id)&&!shared.has(p.id))reasons.push('attendance_not_shared');
  return reasons.map(reason=>({employee_id:p.id,name:p.name,reason}));
 });
}
