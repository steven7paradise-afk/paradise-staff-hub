import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EndOfDayChecklistClient } from "@/components/end-of-day-checklist-client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess, canEdit, getEffectivePermissionSet, type Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function EndOfDayPage({ searchParams }: { searchParams?: Promise<{ entry?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const viewer = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true, mansione: true, active: true, photo_url: true },
  });
  if (!viewer?.active) redirect("/login");
  const permissions = await getEffectivePermissionSet(prisma, viewer);
  const role = viewer.role as Role;
  if (!canAccess("/fine-giornata", role, viewer.mansione ?? undefined, permissions)) redirect("/dashboard");
  const canWrite = canEdit("/fine-giornata", role, viewer.mansione ?? undefined, permissions);
  const params = searchParams ? await searchParams : {};
  const entries = await prisma.endOfDayChecklist.findMany({
    include: {
      submitted_by: { select: { id: true, name: true, photo_url: true } },
      comments: {
        include: { author: { select: { id: true, name: true, photo_url: true } } },
        orderBy: { created_at: "asc" },
      },
    },
    orderBy: [{ operational_date: "desc" }, { updated_at: "desc" }],
    take: 90,
  });

  const serialized = entries.map((entry) => ({
    id: entry.id,
    operationalDate: entry.operational_date.toISOString().slice(0, 10),
    counts: entry.counts as Record<string, number>,
    channels: entry.channels as Record<string, boolean>,
    confirmations: entry.confirmations as Record<string, "YES" | "NO">,
    confirmationNotes: entry.confirmation_notes as Record<string, string>,
    notes: entry.notes ?? "",
    operatorOneName: entry.operator_one_name,
    operatorTwoName: entry.operator_two_name,
    managerName: entry.manager_name,
    submittedAt: entry.submitted_at.toISOString(),
    updatedAt: entry.updated_at.toISOString(),
    submittedBy: {
      id: entry.submitted_by.id,
      name: entry.submitted_by.name,
      photoUrl: entry.submitted_by.photo_url,
    },
    comments: entry.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.created_at.toISOString(),
      author: {
        id: comment.author.id,
        name: comment.author.name,
        photoUrl: comment.author.photo_url,
      },
    })),
  }));

  return (
    <AppShell title="Fine giornata" subtitle="Checklist Assistenza Clienti, anomalie e commenti amministrativi.">
      <EndOfDayChecklistClient
        initialEntries={serialized}
        initialEntryId={params.entry ?? null}
        canWrite={canWrite}
        viewer={{ id: viewer.id, name: viewer.name, photoUrl: viewer.photo_url }}
      />
    </AppShell>
  );
}
