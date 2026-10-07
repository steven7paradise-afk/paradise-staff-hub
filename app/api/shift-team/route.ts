import {NextRequest,NextResponse} from 'next/server';
import {auth} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {loadShiftTeam} from '@/lib/shift-team-data';
import {PRESENTABILITY_REASONS,type TeamNotes} from '@/lib/shift-team';
import {romeAgendaDate} from '@/lib/shift-agenda';
import {resolveShiftResponsible} from '@/lib/shift-responsible-selection-data';
import {emptyShiftAccessDay,hasShiftWriteAccess,normalizeShiftResponsibleAccess,SHIFT_RESPONSIBLE_ACCESS_KEY} from '@/lib/shift-responsible-access';
import {normalizeShiftResponsibleAssignments,WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY} from '@/lib/weekly-shift-responsibles';
const roles=new Set(['ZERO','SUPER_ADMIN','ADMIN','RESPONSABILE']);
export async function GET(request:NextRequest){
 const session=await auth();if(!session?.user?.id||!roles.has(session.user.role))return NextResponse.json({error:'Non autorizzato'},{status:403});
 const day=request.nextUrl.searchParams.get('day');if(day!==romeAgendaDate(new Date()))return NextResponse.json({error:'Giorno non valido'},{status:400});
 try{return NextResponse.json(await loadShiftTeam(day),{headers:{'Cache-Control':'private, no-store'}});}catch{return NextResponse.json({error:'Timbrature non disponibili. Riprova.'},{status:502});}
}
export async function PUT(request:NextRequest){
 const session=await auth();if(!session?.user?.id||!roles.has(session.user.role))return NextResponse.json({error:'Non autorizzato'},{status:403});
 const body=await request.json().catch(()=>null);if(body?.day!==romeAgendaDate(new Date()))return NextResponse.json({error:'Giorno non valido'},{status:400});
 const [access,assignment]=await Promise.all([prisma.setting.findUnique({where:{key:SHIFT_RESPONSIBLE_ACCESS_KEY}}),prisma.setting.findUnique({where:{key:WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY}})]);
 if(!hasShiftWriteAccess(normalizeShiftResponsibleAccess(access?.value)[body.day]||emptyShiftAccessDay(),session.user.id,await resolveShiftResponsible(body.day,normalizeShiftResponsibleAssignments(assignment?.value)[body.day])))return NextResponse.json({error:'Serve la presa visione e il permesso di compilare.'},{status:403});
 try{
 const report=await loadShiftTeam(body.day);
 if(body.action==='sickness'){
  const person=report.people.find(p=>p.id===body.userId);
  if(!person?.issues.some(i=>i.type==='missing'))return NextResponse.json({error:'Persona senza anomalia di ingresso.'},{status:400});
  const date=new Date(`${body.day}T00:00:00Z`);
  const existing=await prisma.leaveRequest.findFirst({where:{user_id:person.id,type:'MALATTIA',status:{in:['PENDING','APPROVED']},start_date:{lte:date},end_date:{gte:date}}});
  if(existing)return NextResponse.json({requestId:existing.id,status:existing.status});
  const created=await prisma.leaveRequest.upsert({where:{id:`shift-team-sickness:${body.day}:${person.id}`},update:{},create:{id:`shift-team-sickness:${body.day}:${person.id}`,user_id:person.id,type:'MALATTIA',status:'PENDING',start_date:date,end_date:date,sickness_unjustified:true,reason:`Segnalazione dal verbale del ${body.day}; da verificare e approvare.`,admin_note:`Inserita da ${session.user.name||'Responsabile'}`}});
  return NextResponse.json({requestId:created.id,status:created.status});
 }
 const notes=body.notes as TeamNotes;
 if(!notes||!['','all','exceptions'].includes(notes.presentation)||!Array.isArray(notes.exceptions)||notes.exceptions.length>100||!notes.decisions||typeof notes.decisions!=='object'||Array.isArray(notes.decisions))return NextResponse.json({error:'Dati Team non validi.'},{status:400});
 const issues=report.people.flatMap(p=>p.issues);
 const known=new Set([...issues.map(i=>i.key),...Object.keys(report.notes.decisions)]);
 for(const [key,d] of Object.entries(notes.decisions)){
  if(!known.has(key)||!d||typeof d.note!=='string'||d.note.length>5000||!['','Giustificato','Non giustificato','Assenza','Dimenticato di timbrare','Malattia richiesta'].includes(d.choice))return NextResponse.json({error:'Giustificazione non valida.'},{status:400});
  const issue=issues.find(i=>i.key===key);
  if(issue&&d.choice&&!(issue.type==='missing'?['Assenza','Dimenticato di timbrare','Malattia richiesta']:['Giustificato','Non giustificato']).includes(d.choice))return NextResponse.json({error:'Scelta non valida per questa anomalia.'},{status:400});
  if(d.choice==='Malattia richiesta'&&issue&&!report.people.some(p=>p.issues.some(i=>i.key===key)&&p.sicknessPending))return NextResponse.json({error:'Crea prima la richiesta di malattia.'},{status:400});
 }
 for(const e of notes.exceptions)if(!e||typeof e.note!=='string'||e.note.length>5000||(e.userId&&!report.people.some(p=>p.id===e.userId&&!p.inactive))||(e.reason&&!(PRESENTABILITY_REASONS as readonly string[]).includes(e.reason)))return NextResponse.json({error:'Eccezione non valida.'},{status:400});
 const key=`shift_team_${body.day}`;const setting=await prisma.setting.findUnique({where:{key}});const current=setting?.value as {version?:string}|null;
 if((current?.version||null)!==body.version)return NextResponse.json({error:'Il Team è stato aggiornato da un altro utente. Ricarica prima di salvare.'},{status:409});
 const value=JSON.parse(JSON.stringify({notes,version:new Date().toISOString(),savedBy:session.user.id}));
 if(setting){const result=await prisma.setting.updateMany({where:{key,value:{equals:setting.value!}},data:{value}});if(!result.count)return NextResponse.json({error:'Dati cambiati nel frattempo. Ricarica.'},{status:409});}else await prisma.setting.create({data:{key,value}});
 return NextResponse.json(await loadShiftTeam(body.day));
 }catch{return NextResponse.json({error:'Salvataggio non riuscito. Riprova.'},{status:500});}
}
