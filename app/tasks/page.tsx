import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TaskDashboard } from "@/components/task-dashboard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { requireServicePageAccess } from "@/lib/service-page-access";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const role = session.user.role as Role;
  await requireServicePageAccess(role, session.user.sedeId, 2);
  const workerWhere =
    role === "RESPONSABILE" || role === "DIPENDENTE"
      ? { active: true, sede_id: session.user.sedeId ?? undefined, role: { not: "SUPER_ADMIN" as const } }
      : { active: true, role: { not: "SUPER_ADMIN" as const } };
  const taskWhere =
    role === "DIPENDENTE" || role === "RESPONSABILE"
      ? { location_id: session.user.sedeId ?? undefined }
      : {};

  const [workers, tasks, categorySetting] = await Promise.all([
    prisma.user.findMany({
      where: workerWhere,
      orderBy: [{ location: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.staffTask.findMany({
      where: taskWhere,
      include: { assignees: true, created_by: true, location: true, comments: { include: { user: true }, orderBy: { created_at: "asc" } } },
      orderBy: { created_at: "desc" },
    }),
    prisma.setting.findUnique({ where: { key: "task_categories" } }),
  ]);
  const taskCategories = Array.isArray(categorySetting?.value)
    ? categorySetting.value.map(String)
    : ["Operativa", "Sala", "Reception", "Bar", "Cucina", "Pulizia", "Magazzino", "Clienti"];

  return (
    <AppShell title="TASK" role={role} hideHeader>
      <TaskDashboard
        role={role}
        userId={session.user.id}
        userName={session.user.name ?? "Paradise"}
        categories={taskCategories}
        workers={workers.map((worker) => ({ id: worker.id, name: worker.name, locationId: worker.sede_id, photoUrl: worker.photo_url }))}
        initialTasks={tasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          category: task.category ?? "Operativa",
          checklist: Array.isArray(task.checklist) ? task.checklist as { text: string; done: boolean }[] : [],
          attachmentName: task.attachment_name,
          attachmentUrl: task.attachment_url,
          photoUrl: task.photo_url,
          linkUrl: task.link_url,
          notes: task.notes,
          timerSeconds: task.timer_seconds,
          completionNote: task.completion_note,
          completionFiles: Array.isArray(task.completion_files)
            ? task.completion_files.map((item) => {
                if (typeof item === "string") return { name: item };
                const record = item as Record<string, unknown>;
                return { name: String(record.name ?? "file"), url: record.url ? String(record.url) : null };
              })
            : [],
          completionLinks: Array.isArray(task.completion_links) ? task.completion_links.map(String) : [],
          evaluation: task.evaluation,
          locationId: task.location_id,
          locationName: task.location.name,
          assignedToId: task.assignees[0]?.id ?? "",
          assignedToName: task.assignees.map((a) => a.name).join(", ") || "Nessuno",
          assignedToPhoto: task.assignees[0]?.photo_url ?? null,
          assignees: task.assignees.map((u) => ({ id: u.id, name: u.name, photoUrl: u.photo_url })),
          createdByName: task.created_by.name,
          createdById: task.created_by_id,
          createdByPhoto: task.created_by.photo_url,
          dueDate: task.due_date?.toISOString() ?? null,
          createdAt: task.created_at.toISOString(),
          updatedAt: task.updated_at.toISOString(),
          comments: task.comments.map((comment) => ({
            id: comment.id,
            message: comment.message,
            userId: comment.user_id,
            userName: comment.user.name,
            userPhoto: comment.user.photo_url,
            createdAt: comment.created_at.toISOString(),
            updatedAt: comment.updated_at.toISOString(),
          })),
        }))}
      />
    </AppShell>
  );
}
