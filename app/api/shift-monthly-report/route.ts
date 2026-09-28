import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isClientControlFormName } from "@/lib/client-control-form";
import { normalizeShiftResponsibleQuestions, normalizeShiftResponsibleAnswers, SHIFT_RESPONSIBLE_QUESTIONS_KEY, SHIFT_RESPONSIBLE_ANSWERS_KEY } from "@/lib/shift-responsible-questions";
import { reportPeriods, summarizeClientMonth, summarizeShiftMonth } from "@/lib/shift-monthly-report";
import { romeDayRange } from "@/lib/shift-reports";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !["ZERO","SUPER_ADMIN","ADMIN"].includes(session.user.role)) return NextResponse.json({error:"Non autorizzato"},{status:403});
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  let periods;
  try { periods = reportPeriods(request.nextUrl.searchParams.get("month") || today.slice(0,7),today); }
  catch { return NextResponse.json({error:"Scegli un mese valido, non futuro."},{status:400}); }
  try {
    const [settings, forms, people] = await Promise.all([
      prisma.setting.findMany({where:{key:{in:[SHIFT_RESPONSIBLE_QUESTIONS_KEY,SHIFT_RESPONSIBLE_ANSWERS_KEY]}},select:{key:true,value:true}}),
      prisma.serviceForm.findMany({select:{id:true,name:true,category:true}}),
      prisma.user.findMany({select:{name:true}}),
    ]);
    const ids=forms.filter(f=>isClientControlFormName(f.name,f.category)).map(f=>f.id);
    const responses=ids.length ? await prisma.serviceFormResponse.findMany({where:{form_id:{in:ids},created_at:{gte:romeDayRange(periods.previous.firstDay).start,lt:romeDayRange(periods.current.lastDay).end}},select:{id:true,created_at:true,answers:true,user_location_name:true}}) : [];
    const questions=normalizeShiftResponsibleQuestions(settings.find(s=>s.key===SHIFT_RESPONSIBLE_QUESTIONS_KEY)?.value);
    const answers=normalizeShiftResponsibleAnswers(settings.find(s=>s.key===SHIFT_RESPONSIBLE_ANSWERS_KEY)?.value);
    const rows=responses.map(r=>({id:r.id,createdAt:r.created_at.toISOString(),answers:r.answers,locationName:r.user_location_name}));
    const names=people.map(p=>p.name);
    return NextResponse.json({generatedAt:now.toISOString(),...periods,shifts:summarizeShiftMonth(questions,answers,periods.current),previousShifts:summarizeShiftMonth(questions,answers,periods.previous),clients:summarizeClientMonth(rows,names,periods.current),previousClients:summarizeClientMonth(rows,names,periods.previous)},{headers:{"Cache-Control":"private, no-store"}});
  } catch {
    return NextResponse.json({error:"Report non disponibile. Riprova tra poco."},{status:500});
  }
}
