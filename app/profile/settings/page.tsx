import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProfileSettings } from "@/components/profile-settings";
import { LogoutButton } from "@/components/logout-button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForUser, type Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");
  if (!await canAccessForUser(prisma, "/profile", { id: user.id, role: user.role, mansione: user.mansione })) redirect("/dashboard");
  return <AppShell title="Gestione profilo" role={user.role as Role}>
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <Link href="/profile" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#96365f] hover:bg-white"><ChevronLeft className="size-4" />Torna al profilo</Link>
      <header><h1 className="text-3xl font-semibold tracking-tight">Gestione profilo</h1><p className="mt-2 text-sm text-neutral-500">Impostazioni personali, accesso e sicurezza del tuo account.</p></header>
      <ProfileSettings photoUrl={user.photo_url} name={user.name} role={user.role} calendarSync={user.google_calendar_sync} calendarId={user.google_calendar_id} headerColor={user.header_color} sidebarColor={user.sidebar_color} />
      <div className="flex justify-end border-t border-neutral-200 pt-5"><LogoutButton className="rounded-xl bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-100" /></div>
    </div>
  </AppShell>;
}
