import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { accessFor } from '@/lib/mcp/permissions';
import { AppShell } from '@/components/app-shell';
import { McpPermissions } from '@/components/mcp-permissions';
export const dynamic='force-dynamic';
export default async function Page(){
 const session=await auth();if(!session?.user?.id)redirect('/login?callbackUrl=/settings/mcp/permissions');
 if((await accessFor(session.user.id))?.role!=='super_admin')redirect('/dashboard');
 const users=await prisma.user.findMany({where:{active:true},select:{id:true,name:true},orderBy:{name:'asc'}});
 const rows=await Promise.all(users.map(async u=>({...u,permissions:(await accessFor(u.id))!})));
 return <AppShell title="Permessi" subtitle="Accesso al connettore Staffhub Admin. Le modifiche si applicano subito, anche ai collegamenti già aperti."><McpPermissions users={rows}/></AppShell>;
}
