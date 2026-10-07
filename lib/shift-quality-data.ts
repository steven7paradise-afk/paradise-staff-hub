import { getShopifyOrderNamesBulk } from "./shopify";
import { prisma } from "./prisma";
import { getCompleteCowlendarBookingsForRange, hasCowlendarToken } from "./cowlendar";
import { romeDayRange } from "./shift-reports";
import { romeAgendaDate } from "./shift-agenda";
import { isClientControlFormName } from "./client-control-form";
import { ASSISTANCE_TABLES_KEY, normalizeAssistanceSheets, type AssistanceSheet } from "./assistance-tables";
import { findPreviousApplication, previousApplicationStaff, type SystemazioneFasceAppointment } from "./systemazione-fasce-table";
import { hasReworkService, type QualityCase } from "./shift-quality";
import { previousApplicationStaffWhere } from "./assistance-table-staff";
const clean = (v: unknown) => String(v || "").trim();
export async function loadShiftQuality(day: string) {
  if (!hasCowlendarToken()) throw new Error("Calendario non disponibile");
  const { start, end } = romeDayRange(day);
  const [bookings, forms, staff, statusSetting] = await Promise.all([
    getCompleteCowlendarBookingsForRange(start.toISOString(), new Date(end.getTime()-1).toISOString()),
    prisma.serviceForm.findMany({ select: { id: true, name: true, category: true } }),
    prisma.user.findMany({ where: previousApplicationStaffWhere, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.setting.findUnique({ where: { key: "appointment_status_overrides" } }),
  ]);
  const statuses = (statusSetting?.value || {}) as Record<string, { status?: string }>;
  const raw = await prisma.serviceFormResponse.findMany({ where: { form_id: { in: forms.filter(f => isClientControlFormName(f.name,f.category)).map(f=>f.id) } }, select: { id:true, answers:true, created_at:true, updated_at:true }, orderBy:{updated_at:"desc"} });
  const latest = new Map<string, typeof raw[number]>();
  for(const c of raw){const a=c.answers as Record<string,unknown>;const key=clean(a.booking_id)||`card:${c.id}`;if(!latest.has(key))latest.set(key,c);}
  const orderNames = await getShopifyOrderNamesBulk(bookings.filter(b => hasReworkService({client_control_service_title:b.service?.title}) || hasReworkService((latest.get(String(b.id))?.answers || {}) as Record<string,unknown>)).map(b=>b.order_id));
  const responses = [...latest.values()].map(c=>({id:c.id,createdAt:c.created_at,answers:c.answers as Record<string,unknown>}));
  const cancelled = (b: typeof bookings[number]) => Boolean(b.is_canceled || b.isCanceled || ["ANNULLATO","CANCELED","CANCELLED","NON_PRESENTATO","NO_SHOW"].includes(clean(statuses[String(b.id)]?.status || b.attendance || b.confirmation_status).toUpperCase()));
  const candidates: Array<{ appointment: SystemazioneFasceAppointment; answers: Record<string,unknown> }> = [];
  const seen = new Set<string>();
  for(const b of bookings){
    const id=String(b.id);if(seen.has(id))continue;seen.add(id);
    if(romeAgendaDate(b.start_date)!==day||cancelled(b)||!/buenos aires/i.test([b.service?.title,b.booking_str,b.form_data?.sede,b.form_data?.salone].join(" ")))continue;
    const a=(latest.get(id)?.answers || {}) as Record<string,unknown>;
    if(!hasReworkService(a)&&!hasReworkService({client_control_service_title:b.service?.title}))continue;
    candidates.push({answers:a,appointment:{id,customerName:clean(a.client_control_client_name)||b.customer?.name||"Cliente",customerEmail:b.customer?.email||null,customerPhone:b.customer?.phone||null,serviceTitle:"Sistemazione fasce",shopifyOrderId:clean(a.client_control_shopify_order)||orderNames.get(String(b.order_id))||null,bookingStr:null,startDate:b.start_date,teammates:[],notesText:null,isCanceled:false}});
  }
  for(const [key,c] of latest){
    const a=c.answers as Record<string,unknown>;
    if(seen.has(key)||!hasReworkService(a)||romeAgendaDate(clean(a.client_control_completed_at)||c.created_at)!==day||!/buenos aires/i.test(clean(a.client_control_location)))continue;
    candidates.push({answers:a,appointment:{id:key,customerName:clean(a.client_control_client_name)||"Cliente",customerEmail:clean(a.client_control_email)||null,customerPhone:clean(a.client_control_phone)||null,serviceTitle:"Sistemazione fasce",shopifyOrderId:clean(a.client_control_shopify_order)||null,bookingStr:null,startDate:(c.created_at).toISOString(),teammates:[],notesText:null,isCanceled:false}});
  }
  for(let attempt=0;attempt<3;attempt++){
    const setting=await prisma.setting.findUnique({where:{key:ASSISTANCE_TABLES_KEY}});
    const sheets=normalizeAssistanceSheets(setting?.value);
    let sheet=sheets.find(s=>/^sistemazione fasc(?:e|ie)$/i.test(s.name.trim()));
    if(!sheet){sheet={id:crypto.randomUUID(),name:"sistemazione fasce",columns:[],rows:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};sheets.push(sheet);}
    const before=JSON.stringify(sheets);
    function column(label:string,pattern:RegExp){let c=sheet!.columns.find(c=>pattern.test(c.label.trim()));if(!c){c={id:crypto.randomUUID(),label,type:"text"};sheet!.columns.push(c);}return c.id;}
    const name=column("nome cliente",/^nome cliente$/i),email=column("email",/^e.?mail$/i),phone=column("telefono",/^telefono$/i),prev=column("app. precedente",/^app\.? precedente$/i),performed=column("sistemazione",/^sistemazione$/i),order=column("Numero ordine",/^(numero )?ordine$/i),cause=column("Causa",/^causa$/i),note=column("note",/^note?$/i);
    const cases:QualityCase[]=[];
    for(const {appointment:a,answers} of candidates){
      const id=String(a.id);const previous=findPreviousApplication(a,responses);
      let row=sheet.rows.find(r=>r.id===`sistemazione-fasce:${id}`||r.values.__qualityBookingId===id);
      if(!row)row=sheet.rows.find(r=>!r.values.__qualityBookingId&&romeAgendaDate(r.createdAt)===day&&clean(r.values[name]).toLowerCase()===a.customerName.toLowerCase()&&((a.customerEmail&&clean(r.values[email]).toLowerCase()===a.customerEmail.toLowerCase())||(a.shopifyOrderId&&clean(r.values[order]).replace(/^#/,'')===a.shopifyOrderId.replace(/^#/,''))));
      if(!row){row={id:`sistemazione-fasce:${id}`,nome:"",cognome:"",testo:"",image:null,file:null,values:{},createdAt:a.startDate,updatedAt:new Date().toISOString(),reviewedAt:null,reviewedBy:null};sheet.rows.unshift(row);}
      const old=JSON.stringify(row.values);
      const confirmed=answers.client_control_is_draft!==true&&answers.client_control_is_draft!=="true"&&clean(answers.client_control_correctness).toLowerCase()==="controllato"&&hasReworkService(answers);
      row.values.__qualityManaged="true";row.values.__qualityBookingId=id;row.values.__qualityConfirmed=String(confirmed);
      if(!row.values[name])row.values[name]=a.customerName;
      if(!row.values[email])row.values[email]=a.customerEmail||"";
      if(!row.values[phone])row.values[phone]=a.customerPhone||"";
      if(!row.values[prev]||row.values[prev]==="Da verificare") { if(row.values.__previousStaffManual!=="true")row.values[prev]=previousApplicationStaff(previous)||"Da verificare"; }
      if(!row.values[order]&&a.shopifyOrderId)row.values[order]=a.shopifyOrderId;
      const performer=Array.isArray(answers.client_control_service_staff)?answers.client_control_service_staff.join(", "):clean(answers.client_control_service_staff||answers.client_control_service_owner);
      if(confirmed&&performer&&row.values.__currentStaffManual!=="true")row.values[performed]=performer;
      if(old!==JSON.stringify(row.values))row.updatedAt=new Date().toISOString();
      cases.push({id,rowId:row.id,version:row.updatedAt,client:a.customerName,time:new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",hour:"2-digit",minute:"2-digit"}).format(new Date(a.startDate)),order:clean(row.values[order]),previous:clean(row.values[prev]),previousDate:previous?romeAgendaDate(previous.createdAt):"",performer:clean(row.values[performed]),cause:clean(row.values[cause]||row.values.__qualityCause),note:clean(row.values[note]),confirmed,saved:Boolean(row.reviewedAt && row.values.__qualityReviewedAt && confirmed)});
    }
    if(JSON.stringify(sheets)!==before){sheet.updatedAt=new Date().toISOString();if(!setting){const saved=await prisma.setting.createMany({data:[{key:ASSISTANCE_TABLES_KEY,value:JSON.parse(JSON.stringify(sheets))}],skipDuplicates:true});if(!saved.count)continue;}else{const saved=await prisma.setting.updateMany({where:{key:ASSISTANCE_TABLES_KEY,value:{equals:setting.value!}},data:{value:JSON.parse(JSON.stringify(sheets))}});if(!saved.count)continue;}}
    return {cases,staff,sheetId:sheet.id};
  }
  throw new Error("Tabella aggiornata nel frattempo. Riprova.");
}
