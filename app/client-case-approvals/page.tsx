import {redirect} from 'next/navigation';
import {auth} from '@/lib/auth';
import {AppShell} from '@/components/app-shell';
import {ShiftClientCasesPanel} from '@/components/shift-client-cases-panel';
import {romeAgendaDate} from '@/lib/shift-agenda';
export default async function ClientCaseApprovals({searchParams}:{searchParams:Promise<{day?:string}>}){
 const session=await auth();if(!session?.user?.id)redirect('/login');if(!['ZERO','SUPER_ADMIN','ADMIN'].includes(session.user.role))redirect('/dashboard');const query=await searchParams;const today=romeAgendaDate(new Date());const day=query.day&&/^\d{4}-\d{2}-\d{2}$/.test(query.day)&&query.day<=today?query.day:today;
 return <AppShell title="Autorizzazioni casi clienti" role={session.user.role}><div className="shift-responsible-page mx-auto max-w-6xl p-4"><h1 className="mb-4 text-xl font-bold">Autorizzazioni clienti · {day.split('-').reverse().join('/')}</h1><ShiftClientCasesPanel day={day} reviewOnly/></div></AppShell>;
}
