import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ShiftResponsibleQuestionManager } from "@/components/shift-responsible-question-manager";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { normalizeShiftResponsibleQuestions, SHIFT_RESPONSIBLE_QUESTIONS_KEY } from "@/lib/shift-responsible-questions";

export const dynamic = "force-dynamic";
const adminRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

export default async function ModificaModuloTurnoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!adminRoles.has(session.user.role)) redirect("/responsabile-di-turno");
  const setting = await prisma.setting.findUnique({ where: { key: SHIFT_RESPONSIBLE_QUESTIONS_KEY } });

  return (
    <AppShell title="Modifica modulo del turno" role={session.user.role as Role} edgeToEdgeMain>
      <main className="min-h-screen bg-[#f4f1fa]">
        <div className="px-3 pt-5 sm:px-8 xl:px-12 xl:pt-20"><Link href="/programmazione-responsabile-di-turno" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-4 text-[10px] font-black text-[#874363] shadow-sm"><ArrowLeft className="size-4" />Torna al controllo</Link></div>
        <ShiftResponsibleQuestionManager initialQuestions={normalizeShiftResponsibleQuestions(setting?.value)} />
      </main>
    </AppShell>
  );
}
