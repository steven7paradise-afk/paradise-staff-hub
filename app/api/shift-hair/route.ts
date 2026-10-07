import {NextRequest,NextResponse} from 'next/server';
import {auth} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {HAIR_CATEGORIES,validHairNotes} from '@/lib/shift-hair';
import {romeAgendaDate} from '@/lib/shift-agenda';
import {resolveShiftResponsible} from '@/lib/shift-responsible-selection-data';
import {emptyShiftAccessDay,hasShiftWriteAccess,normalizeShiftResponsibleAccess,SHIFT_RESPONSIBLE_ACCESS_KEY} from '@/lib/shift-responsible-access';
import {normalizeShiftResponsibleAssignments,WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY} from '@/lib/weekly-shift-responsibles';
const roles=new Set(['ZERO','SUPER_ADMIN','ADMIN','RESPONSABILE']);
async function load(day:string){const [products,saved]=await Promise.all([prisma.inventoryProduct.findMany({where:{active:true,category:{in:HAIR_CATEGORIES}},select:{id:true,name:true,category:true,sku:true},orderBy:[{category:'asc'},{name:'asc'}]}),prisma.setting.findUnique({where:{key:`shift_hair_${day}`}})]);return {products,...(saved?.value as object||{notes:{lowStock:null,rows:[]},version:null})};}
export async function GET(request:NextRequest){const session=await auth();if(!session?.user?.id||!roles.has(session.user.role))return NextResponse.json({error:'Non autorizzato'},{status:403});const day=request.nextUrl.searchParams.get('day');if(day!==romeAgendaDate(new Date()))return NextResponse.json({error:'Giorno non valido'},{status:400});try{return NextResponse.json(await load(day),{headers:{'Cache-Control':'private, no-store'}});}catch{return NextResponse.json({error:'Catalogo Magazzino non disponibile.'},{status:502});}}
export async function PUT(request:NextRequest){
 const session=await auth();if(!session?.user?.id||!roles.has(session.user.role))return NextResponse.json({error:'Non autorizzato'},{status:403});const body=await request.json().catch(()=>null);if(body?.day!==romeAgendaDate(new Date()))return NextResponse.json({error:'Giorno non valido'},{status:400});
 const [access,assignment]=await Promise.all([prisma.setting.findUnique({where:{key:SHIFT_RESPONSIBLE_ACCESS_KEY}}),prisma.setting.findUnique({where:{key:WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY}})]);
 if(!hasShiftWriteAccess(normalizeShiftResponsibleAccess(access?.value)[body.day]||emptyShiftAccessDay(),session.user.id,await resolveShiftResponsible(body.day,normalizeShiftResponsibleAssignments(assignment?.value)[body.day])))return NextResponse.json({error:'Serve la presa visione e il permesso di compilare.'},{status:403});
 try{const data=await load(body.day);if(!validHairNotes(body.notes,new Set(data.products.map(p=>p.id))))return NextResponse.json({error:'Scegli una tonalità per riga, senza duplicati. Indica grammi presenti (anche zero), grammi da ordinare maggiori di zero e note di massimo 1.000 caratteri.'},{status:400});
 const key=`shift_hair_${body.day}`;const setting=await prisma.setting.findUnique({where:{key}});const current=setting?.value as {version?:string}|null;
 if((current?.version||null)!==body.version)return NextResponse.json({error:'Dati cambiati: ricarica prima di salvare.'},{status:409});
 const value=JSON.parse(JSON.stringify({notes:body.notes,version:new Date().toISOString(),savedBy:session.user.id,signals:body.notes.rows.map((r:{productId:string;present:string;order:string;note:string})=>({productId:r.productId,productName:data.products.find(p=>p.id===r.productId)?.name,presentGrams:Number(r.present.replace(',','.')),orderGrams:Number(r.order.replace(',','.')),note:r.note,status:'DRAFT'}))}));
 if(setting){const result=await prisma.setting.updateMany({where:{key,value:{equals:setting.value!}},data:{value}});if(!result.count)return NextResponse.json({error:'Dati cambiati: ricarica.'},{status:409});}else await prisma.setting.create({data:{key,value}});
 return NextResponse.json(await load(body.day));}catch{return NextResponse.json({error:'Salvataggio non riuscito. Riprova.'},{status:500});}
}
