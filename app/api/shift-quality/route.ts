import { resolveShiftResponsible } from "@/lib/shift-responsible-selection-data";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadShiftQuality } from "@/lib/shift-quality-data";
import { applyQualityAttribution, QUALITY_CAUSES } from "@/lib/shift-quality";
import { romeAgendaDate } from "@/lib/shift-agenda";
import { ASSISTANCE_TABLES_KEY, normalizeAssistanceSheets } from "@/lib/assistance-tables";
import { emptyShiftAccessDay, hasShiftWriteAccess, normalizeShiftResponsibleAccess, SHIFT_RESPONSIBLE_ACCESS_KEY } from "@/lib/shift-responsible-access";
import { normalizeShiftResponsibleAssignments, WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY } from "@/lib/weekly-shift-responsibles";
const roles = new Set(["ZERO","SUPER_ADMIN","ADMIN","RESPONSABILE"]);
export async function GET(request:NextRequest){
 const session=await auth();if(!session?.user?.id||!roles.has(session.user.role))return NextResponse.json({error:"Non autorizzato"},{status:403});
 const day=request.nextUrl.searchParams.get("day");if(day!==romeAgendaDate(new Date()))return NextResponse.json({error:"Giorno non valido"},{status:400});
 try{return NextResponse.json(await loadShiftQuality(day),{headers:{"Cache-Control":"private, no-store"}});}catch{return NextResponse.json({error:"Sistemazioni non disponibili. Riprova."},{status:502});}
}
export async function PUT(request:NextRequest){
 const session=await auth();if(!session?.user?.id||!roles.has(session.user.role))return NextResponse.json({error:"Non autorizzato"},{status:403});
 const body=await request.json().catch(()=>null);
 if(!body||body.day!==romeAgendaDate(new Date())||!QUALITY_CAUSES.includes(body.cause)||typeof body.note!=="string"||body.note.length>5000)return NextResponse.json({error:"Indica una causa valida e una nota di massimo 5.000 caratteri."},{status:400});
 const [access,assignments]=await Promise.all([prisma.setting.findUnique({where:{key:SHIFT_RESPONSIBLE_ACCESS_KEY}}),prisma.setting.findUnique({where:{key:WEEKLY_SHIFT_RESPONSIBLES_SETTING_KEY}})]);
 if(!hasShiftWriteAccess(normalizeShiftResponsibleAccess(access?.value)[body.day]||emptyShiftAccessDay(),session.user.id,await resolveShiftResponsible(body.day, normalizeShiftResponsibleAssignments(assignments?.value)[body.day])))return NextResponse.json({error:"Serve la presa visione e il permesso di compilare il turno."},{status:403});
 try{
 const data=await loadShiftQuality(body.day);const item=data.cases.find(c=>c.rowId===body.rowId);
 if(!item)return NextResponse.json({error:"Sistemazione non presente oggi."},{status:404});
 if(!data.staff.some(p=>p.name===body.performer))return NextResponse.json({error:"Seleziona chi ha sistemato."},{status:400});
 const setting=await prisma.setting.findUnique({where:{key:ASSISTANCE_TABLES_KEY}});const sheets=normalizeAssistanceSheets(setting?.value);const sheet=sheets.find(s=>s.id===data.sheetId);const row=sheet?.rows.find(r=>r.id===body.rowId);
 if(!row||!sheet||!setting)return NextResponse.json({error:"Riga non trovata"},{status:404});
 if(row.updatedAt!==body.version)return NextResponse.json({error:"La riga è cambiata. Aggiorna e controlla prima di salvare."},{status:409});
 const performer=sheet.columns.find(c=>/^sistemazione$/i.test(c.label));const cause=sheet.columns.find(c=>/^causa$/i.test(c.label));const note=sheet.columns.find(c=>/^note?$/i.test(c.label));
 const previousColumn=sheet.columns.find(c=>/^(?:app|add|appuntamento)\.?\s+precedente$/i.test(c.label.trim()));
 if(!previousColumn)throw new Error("Colonna precedente mancante");
 if(!performer||!cause||!note)throw new Error("Colonne mancanti");
 const now=new Date().toISOString();row.values[performer.id]=body.performer;row.values[cause.id]=body.cause;row.values[note.id]=body.note.trim();row.values.__currentStaffManual="true";row.values.__qualityCause=body.cause;row.values.__qualityReviewedAt=now;row.values.__qualityConfirmed=String(item.confirmed);row.updatedAt=now;row.reviewedAt=item.confirmed?now:null;row.reviewedBy=item.confirmed?(session.user.name||"Responsabile"):null;sheet.updatedAt=now;
 applyQualityAttribution(row.values,previousColumn.id,body.cause);
 const saved=await prisma.setting.updateMany({where:{key:ASSISTANCE_TABLES_KEY,value:{equals:setting.value!}},data:{value:JSON.parse(JSON.stringify(sheets))}});
 if(!saved.count)return NextResponse.json({error:"Tabella aggiornata nel frattempo. Riprova."},{status:409});
 return NextResponse.json({saved:true});
 }catch{return NextResponse.json({error:"Modifica non salvata. Riprova."},{status:500});}
}
