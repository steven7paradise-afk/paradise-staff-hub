import {NextRequest,NextResponse} from 'next/server';
import {auth} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {emptyCashNotes,validCashNotes} from '@/lib/shift-cash';
import {romeAgendaDate} from '@/lib/shift-agenda';
import {resolveShiftResponsible} from '@/lib/shift-responsible-selection-data';
import {emptyShiftAccessDay,hasShiftWriteAccess,normalizeShiftResponsibleAccess,SHIFT_RESPONSIBLE_ACCESS_KEY} from '@/lib/shift-responsible-access';
import {normalizeShiftResponsibleAssignments,WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY} from '@/lib/weekly-shift-responsibles';
const roles=new Set(['ZERO','SUPER_ADMIN','ADMIN','RESPONSABILE']);
async function load(day:string){const saved=await prisma.setting.findUnique({where:{key:`shift_cash_${day}`}});return saved?.value as object||{notes:emptyCashNotes,version:null,confirmedBy:null,confirmedAt:null};}
export async function GET(request:NextRequest){const session=await auth();if(!session?.user?.id||!roles.has(session.user.role))return NextResponse.json({error:'Non autorizzato'},{status:403});const day=request.nextUrl.searchParams.get('day');if(day!==romeAgendaDate(new Date()))return NextResponse.json({error:'Giorno non valido'},{status:400});try{return NextResponse.json(await load(day),{headers:{'Cache-Control':'private, no-store'}});}catch{return NextResponse.json({error:'Dati cassa non disponibili.'},{status:502});}}
export async function PUT(request:NextRequest){
 const session=await auth();if(!session?.user?.id||!roles.has(session.user.role))return NextResponse.json({error:'Non autorizzato'},{status:403});const body=await request.json().catch(()=>null);if(body?.day!==romeAgendaDate(new Date()))return NextResponse.json({error:'Giorno non valido'},{status:400});
 const [access,assignment]=await Promise.all([prisma.setting.findUnique({where:{key:SHIFT_RESPONSIBLE_ACCESS_KEY}}),prisma.setting.findUnique({where:{key:WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY}})]);
 if(!hasShiftWriteAccess(normalizeShiftResponsibleAccess(access?.value)[body.day]||emptyShiftAccessDay(),session.user.id,await resolveShiftResponsible(body.day,normalizeShiftResponsibleAssignments(assignment?.value)[body.day])))return NextResponse.json({error:'Serve la presa visione e il permesso di compilare.'},{status:403});
 try{if(!validCashNotes(body.notes))return NextResponse.json({error:'Indica se ci sono discrepanze. Se sì, compila importo positivo, tipo e spiegazione.'},{status:400});
 const key=`shift_cash_${body.day}`;const setting=await prisma.setting.findUnique({where:{key}});const current=setting?.value as {version?:string;notes?:{closed:boolean};confirmedBy?:string;confirmedAt?:string}|null;
 if((current?.version||null)!==body.version)return NextResponse.json({error:'Dati cambiati: ricarica prima di salvare.'},{status:409});
 const now=new Date().toISOString();
 const notes={discrepancy:body.notes.discrepancy,amount:body.notes.discrepancy?body.notes.amount:'',kind:body.notes.discrepancy?body.notes.kind:'',explanation:body.notes.discrepancy?body.notes.explanation.trim():'',closed:body.notes.closed};
 const value=JSON.parse(JSON.stringify({notes,version:now,savedBy:session.user.id,confirmedBy:notes.closed?(current?.notes?.closed?current.confirmedBy:session.user.name||session.user.id):null,confirmedAt:notes.closed?(current?.notes?.closed?current.confirmedAt:now):null}));
 if(setting){const result=await prisma.setting.updateMany({where:{key,value:{equals:setting.value!}},data:{value}});if(!result.count)return NextResponse.json({error:'Dati cambiati: ricarica.'},{status:409});}else await prisma.setting.create({data:{key,value}});
 return NextResponse.json(await load(body.day));}catch{return NextResponse.json({error:'Salvataggio non riuscito. Riprova.'},{status:500});}
}
