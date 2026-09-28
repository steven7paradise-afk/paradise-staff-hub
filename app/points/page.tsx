import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/app-shell';
import { MonthlyBonusClient } from '@/components/monthly-bonus-client';
import { romeBonusDay, usesMonthlyBonus } from '@/lib/monthly-bonus';
import LegacyPointsPage from '@/lib/legacy-points-page';
export const dynamic='force-dynamic';
export default async function PointsPage(props:{searchParams:Promise<{userId?:string}>}){
 if(!usesMonthlyBonus())return <LegacyPointsPage {...props}/>;
 const session=await auth();if(!session?.user?.id)redirect('/login');
 const user=await prisma.user.findUnique({where:{id:session.user.id},select:{active:true,role:true}});
 if(!user?.active)redirect('/login');
 return <AppShell title="Centro Punti" role={user.role}><MonthlyBonusClient initialMonth={romeBonusDay().slice(0,7)}/></AppShell>;
}
