import {prisma} from './prisma';
import {romeDayRange} from './shift-reports';
import {buildTeamPerson,emptyTeamNotes,type TeamNotes} from './shift-team';
export async function loadShiftTeam(day:string){
 const {date,start,end}=romeDayRange(day);
 const [users,setting]=await Promise.all([
 prisma.user.findMany({where:{active:true,employee_status:{not:'Ex dipendente'},role:{in:['DIPENDENTE','RESPONSABILE']},OR:[{location:{name:{contains:'Buenos Aires',mode:'insensitive'}}},{schedule_entries:{some:{date,location:{name:{contains:'Buenos Aires',mode:'insensitive'}}}}}]},select:{id:true,name:true,schedule_entries:{where:{date},select:{start_time:true,end_time:true,category:{select:{name:true,start_time:true,end_time:true}}}},attendance_logs:{where:{timestamp:{gte:start,lt:end}},select:{type:true,timestamp:true}},leave_requests:{where:{status:{in:['APPROVED','PENDING']},start_date:{lte:date},end_date:{gte:date}},select:{type:true,status:true,start_time:true,end_time:true}}},orderBy:{name:'asc'}}),
 prisma.setting.findUnique({where:{key:`shift_team_${day}`}})]);
 const now=new Date();const people=users.map(u=>{const entry=u.schedule_entries[0];const leave=u.leave_requests.find(l=>l.status==='APPROVED'&&!l.start_time&&!l.end_time);return buildTeamPerson({id:u.id,name:u.name,category:leave?`${leave.type.toLowerCase()} approvata`:entry?.category.name||'Non programmato',start:entry?.start_time||entry?.category.start_time||null,end:entry?.end_time||entry?.category.end_time||null,logs:u.attendance_logs,sicknessPending:u.leave_requests.some(l=>l.type==='MALATTIA'&&l.status==='PENDING')},now);});
 const saved=setting?.value as {notes:TeamNotes;version:string}|null;
 return {people,notes:saved?.notes||emptyTeamNotes(),version:saved?.version||null};
}
