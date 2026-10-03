import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canAccessForUser } from '@/lib/roles';
import { loadClientControlAnalytics } from '@/lib/client-control-analytics-data';
import { monthlyStaffReport } from '@/lib/client-control-monthly-report';
import { createClientControlMonthlyPdf } from '@/lib/client-control-monthly-pdf';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const session=await auth();
  if(!session?.user?.id)return Response.json({error:'Accedi per scaricare il report.'},{status:401});
  const user=await prisma.user.findUnique({where:{id:session.user.id},select:{id:true,role:true,mansione:true,access_list:true}});
  if(!user || !(await canAccessForUser(prisma,'/client-control',user)))return Response.json({error:'Accesso non consentito.'},{status:403});
  const month=new URL(request.url).searchParams.get('month')||'';
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))return Response.json({error:'Seleziona un mese valido.'},{status:400});
  try {
    const data=await loadClientControlAnalytics(month);
    if(data.warning || data.delayWarning)return Response.json({error:'Dati del mese incompleti. Riprova: il report non è stato generato.'},{status:503});
    const people=monthlyStaffReport(data.rows,data.staff,data.delays,data.attendanceDays);
    return new Response(createClientControlMonthlyPdf(month,people),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="report-personale-buenos-aires-${month}.pdf"`,'Cache-Control':'private, no-store'}});
  } catch {return Response.json({error:'Impossibile generare il PDF. Riprova tra poco.'},{status:500});}
}
