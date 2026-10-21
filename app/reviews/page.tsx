import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { accessFor } from '@/lib/mcp/permissions';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/app-shell';
import { GoogleReviews } from '@/components/google-reviews';
import { eligibleStaffWhere, listReviews, reviewsSummary } from '@/lib/google-business/reviews';
import { DateKey } from '@/lib/mcp/schemas';
export const dynamic='force-dynamic';
export default async function ReviewsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const session=await auth();if(!session?.user?.id)redirect('/login?callbackUrl=/reviews');
 if((await accessFor(session.user.id))?.role!=='super_admin')redirect('/dashboard');
 const params=await searchParams;
 const from=DateKey.safeParse(params.from).success?params.from:undefined,to=DateKey.safeParse(params.to).success?params.to:undefined;
 const connection=await prisma.googleBusinessConnection.findUnique({where:{id:'primary'},select:{location_name:true,location_title:true,synced_at:true,sync_error:true}});
 const staff=await prisma.user.findMany({where:eligibleStaffWhere,select:{id:true,name:true},orderBy:{name:'asc'}});
 const invalidRange=Boolean(from&&to&&from>to);
 const data=connection?.location_name&&!invalidRange?await listReviews({from,to,cursor:params.cursor}):{reviews:[],next_cursor:null};
 const summary=connection?.synced_at?await reviewsSummary():null;
 const errors:Record<string,string>={wrong_account:'Usa l’account aziendale configurato, non un account personale.',connected:'Account collegato. Seleziona la scheda Paradise di Corso Buenos Aires.',denied:'Collegamento annullato su Google.',invalid_state:'Collegamento scaduto. Premi di nuovo “Collega account Google”.',missing_scope:'Autorizzazione incompleta: concedi l’accesso alla scheda Google.',failed:'Collegamento non riuscito. Controlla le credenziali Google e riprova.'};
 return <AppShell title="Recensioni" subtitle="Paradise · Corso Buenos Aires, Milano">
  {params.google&&errors[params.google]&&<p role="status" className="mb-5 rounded-lg border p-4">{errors[params.google]}</p>}
  <div className="mb-6 flex flex-wrap items-end gap-x-10 gap-y-4 border-b pb-5">
   <div><p className="text-sm text-slate-500">Valutazione Google</p><p className="text-3xl font-semibold">{summary?.average_rating?.toFixed(1) || '—'} <span className="text-base font-normal">/ 5</span></p><p className="text-sm">{summary?.total_reviews ?? '—'} recensioni totali</p></div>
   {(['today','week','month'] as const).map((key,i)=><div key={key}><p className="text-sm text-slate-500">{['Oggi','Questa settimana','Questo mese'][i]}</p><p className="font-semibold">{summary?.[key].count ?? '—'} recensioni</p><p className="text-sm">Media {summary?.[key].avg?.toFixed(1) || '—'}</p></div>)}
  </div>
  <p className="mb-4 text-sm text-slate-500">{connection?.synced_at?`Ultimo aggiornamento: ${connection.synced_at.toLocaleString('it-IT',{timeZone:'Europe/Rome'})}.`:'Non ancora sincronizzato.'} {process.env.GBP_SYNC_ENABLED==='true'?'Aggiornamento automatico ogni 15 minuti.':'Sincronizzazione automatica da attivare sul server.'} I riepiloghi del periodo sono calcolati sulle recensioni Google importate.</p>
  {connection?.sync_error&&<p role="alert" className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4">{connection.sync_error}</p>}
  <form className="mb-5 flex flex-wrap items-end gap-3" action="/reviews"><label className="text-sm">Dal<input name="from" type="date" defaultValue={from} className="mt-1 block rounded-lg border p-2"/></label><label className="text-sm">Al<input name="to" type="date" defaultValue={to} className="mt-1 block rounded-lg border p-2"/></label><button className="rounded-lg border px-4 py-2">Filtra</button><Link href="/reviews" className="p-2 text-sm underline">Tutte</Link></form>
  {invalidRange&&<p role="alert">La data iniziale deve precedere la data finale.</p>}
  <GoogleReviews reviews={data.reviews} staff={staff} connected={Boolean(connection)} locationSelected={Boolean(connection?.location_name)}/>
  {data.next_cursor&&<Link className="mt-5 inline-block rounded-lg border px-4 py-3" href={`/reviews?${new URLSearchParams({...from?{from}:{},...to?{to}:{},cursor:data.next_cursor})}`}>Recensioni successive</Link>}
 </AppShell>;
}
