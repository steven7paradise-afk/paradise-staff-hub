import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EndOfDayChecklistClient } from "@/components/end-of-day-checklist-client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const adminRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);

export default async function EndOfDayPage({ searchParams }: { searchParams?: Promise<{ entry?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!adminRoles.has(session.user.role)) redirect("/dashboard");
  const params = searchParams ? await searchParams : {};
  const [entries, viewer] = await Promise.all([
    prisma.endOfDayChecklist.findMany({
      include: {
        submitted_by: { select: { id: true, name: true, photo_url: true } },
        comments: {
          include: { author: { select: { id: true, name: true, photo_url: true } } },
          orderBy: { created_at: "asc" },
        },
      },
      orderBy: [{ operational_date: "desc" }, { updated_at: "desc" }],
      take: 90,
    }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, photo_url: true } }),
  ]);

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
        viewer={{ id: viewer?.id ?? session.user.id, name: viewer?.name ?? session.user.name ?? "Admin", photoUrl: viewer?.photo_url ?? null }}
      />
    </AppShell>
  );
}
