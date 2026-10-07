import {NextRequest,NextResponse} from 'next/server';
import {auth} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {HAIR_CATEGORIES} from '@/lib/shift-hair';
import {validSupplyNotes,supplyAmounts} from '@/lib/shift-products';
import {romeAgendaDate} from '@/lib/shift-agenda';
import {resolveShiftResponsible} from '@/lib/shift-responsible-selection-data';
import {emptyShiftAccessDay,hasShiftWriteAccess,normalizeShiftResponsibleAccess,SHIFT_RESPONSIBLE_ACCESS_KEY} from '@/lib/shift-responsible-access';
import {normalizeShiftResponsibleAssignments,WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY} from '@/lib/weekly-shift-responsibles';
const roles=new Set(['ZERO','SUPER_ADMIN','ADMIN','RESPONSABILE']);
async function load(day:string){
 const [products,counts,locations,saved]=await Promise.all([
 prisma.inventoryProduct.findMany({where:{active:true,OR:[{category:null},{category:{notIn:HAIR_CATEGORIES}}]},select:{id:true,name:true,category:true,sku:true},orderBy:{name:'asc'}}),
 prisma.inventoryLabel.groupBy({by:['product_id','location_id'],where:{status:'AVAILABLE',location:{active:true}},_count:{_all:true}}),
 prisma.inventoryLocation.findMany({where:{active:true},select:{id:true,kind:true,name:true,linked_location:{select:{name:true}}}}),
 prisma.setting.findUnique({where:{key:`shift_products_${day}`}})]);
 const warehouses=new Set(locations.filter(l=>l.kind==='WAREHOUSE').map(l=>l.id));
 const salons=new Set(locations.filter(l=>l.kind==='SALON'&&/buenos aires/i.test(l.linked_location?.name||l.name)).map(l=>l.id));
 return {products:products.map(p=>({...p,available:counts.filter(c=>c.product_id===p.id&&warehouses.has(c.location_id)).reduce((n,c)=>n+c._count._all,0),salon:counts.filter(c=>c.product_id===p.id&&salons.has(c.location_id)).reduce((n,c)=>n+c._count._all,0)})),stockUpdatedAt:new Date().toISOString(),...(saved?.value as object||{notes:{needed:null,rows:[]},version:null})};
}
export async function GET(request:NextRequest){const session=await auth();if(!session?.user?.id||!roles.has(session.user.role))return NextResponse.json({error:'Non autorizzato'},{status:403});const day=request.nextUrl.searchParams.get('day');if(day!==romeAgendaDate(new Date()))return NextResponse.json({error:'Giorno non valido'},{status:400});try{return NextResponse.json(await load(day),{headers:{'Cache-Control':'private, no-store'}});}catch{return NextResponse.json({error:'Catalogo Magazzino non disponibile.'},{status:502});}}
export async function PUT(request:NextRequest){
 const session=await auth();if(!session?.user?.id||!roles.has(session.user.role))return NextResponse.json({error:'Non autorizzato'},{status:403});const body=await request.json().catch(()=>null);if(body?.day!==romeAgendaDate(new Date()))return NextResponse.json({error:'Giorno non valido'},{status:400});
 const [access,assignment]=await Promise.all([prisma.setting.findUnique({where:{key:SHIFT_RESPONSIBLE_ACCESS_KEY}}),prisma.setting.findUnique({where:{key:WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY}})]);
 if(!hasShiftWriteAccess(normalizeShiftResponsibleAccess(access?.value)[body.day]||emptyShiftAccessDay(),session.user.id,await resolveShiftResponsible(body.day,normalizeShiftResponsibleAssignments(assignment?.value)[body.day])))return NextResponse.json({error:'Serve la presa visione e il permesso di compilare.'},{status:403});
 try{const data=await load(body.day);if(!validSupplyNotes(body.notes,new Set(data.products.map(p=>p.id))))return NextResponse.json({error:'Indica il prodotto e una quantità intera maggiore di zero, senza duplicati. Le note possono contenere fino a 1.000 caratteri.'},{status:400});
 const key=`shift_products_${body.day}`;const setting=await prisma.setting.findUnique({where:{key}});const current=setting?.value as {version?:string}|null;
 if((current?.version||null)!==body.version)return NextResponse.json({error:'Dati cambiati: ricarica prima di salvare.'},{status:409});
 const value=JSON.parse(JSON.stringify({notes:{...body.notes,rows:body.notes.rows.map((r:{productId:string;name:string;quantity:string;note:string})=>({...r,name:data.products.find(p=>p.id===r.productId)?.name||r.name.trim()}))},version:new Date().toISOString(),savedBy:session.user.id,signals:body.notes.rows.map((r:{productId:string;name:string;quantity:string;note:string})=>{const product=data.products.find(p=>p.id===r.productId);return {productId:r.productId||null,productName:product?.name||r.name.trim(),requested:Number(r.quantity),available:product?.available??null,...(product?supplyAmounts(Number(r.quantity),product.available):{bring:null,missing:null}),note:r.note,status:'DRAFT'};})}));
 if(setting){const result=await prisma.setting.updateMany({where:{key,value:{equals:setting.value!}},data:{value}});if(!result.count)return NextResponse.json({error:'Dati cambiati: ricarica.'},{status:409});}else await prisma.setting.create({data:{key,value}});
 return NextResponse.json(await load(body.day));}catch{return NextResponse.json({error:'Salvataggio non riuscito. Riprova.'},{status:500});}
}
