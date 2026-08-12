import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TaskDashboard } from "@/components/task-dashboard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { hasTaskAccess, isTaskOfficeUser, taskWorkerWhere } from "@/lib/task-access";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const role = session.user.role as Role;
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, mansione: true, sede_id: true, location: { select: { name: true } } },
  });
  if (!hasTaskAccess(role, currentUser?.mansione, currentUser?.location?.name)) redirect("/dashboard");

  const canSeeAllTaskLocations = isTaskOfficeUser(role, currentUser?.mansione, currentUser?.location?.name);
  const canSeeAllTasks = role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN" || canSeeAllTaskLocations;
  const taskLocationFilter = canSeeAllTaskLocations ? {} : { location_id: currentUser?.sede_id ?? undefined };
  const workerWhere =
    canSeeAllTaskLocations
      ? taskWorkerWhere()
      : { ...taskWorkerWhere(), sede_id: currentUser?.sede_id ?? undefined };
  const taskWhere = canSeeAllTasks
    ? taskLocationFilter
    : {
        ...taskLocationFilter,
        OR: [
          { created_by_id: session.user.id },
          { assignees: { some: { id: session.user.id } } },
        ],
      };

  const [workers, tasks, categorySetting] = await Promise.all([
    prisma.user.findMany({
      where: workerWhere,
      select: { id: true, name: true, sede_id: true, photo_url: true, mansione: true, role: true },
      orderBy: [{ location: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.staffTask.findMany({
      where: taskWhere,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        category: true,
        timer_seconds: true,
        evaluation: true,
        location_id: true,
        created_by_id: true,
        due_date: true,
        started_at: true,
        completed_at: true,
        created_at: true,
        updated_at: true,
        assignees: { select: { id: true, name: true, photo_url: true } },
        created_by: { select: { id: true, name: true, photo_url: true } },
        location: { select: { id: true, name: true } },
      },
      orderBy: { created_at: "desc" },
      take: 120,
    }),
    prisma.setting.findUnique({ where: { key: "task_categories" } }),
  ]);
  const taskCategories = Array.isArray(categorySetting?.value)
    ? categorySetting.value.map(String)
    : ["Operativa", "Sala", "Reception", "Bar", "Cucina", "Pulizia", "Magazzino", "Clienti"];

  return (
    <AppShell title="Task" role={role} hideHeader>
      <TaskDashboard
        role={role}
        userId={session.user.id}
        userName={session.user.name ?? "Paradise"}
        canManageTasks={canSeeAllTasks}
        categories={taskCategories}
        workers={workers.map((worker) => ({ id: worker.id, name: worker.name, locationId: worker.sede_id, photoUrl: worker.photo_url, mansione: worker.mansione, role: worker.role }))}
        initialTasks={tasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: "",
          status: task.status,
          priority: task.priority,
          category: task.category ?? "Operativa",
          checklist: [],
          detailsLoaded: false,
          attachmentName: null,
          attachmentUrl: null,
          photoUrl: null,
          linkUrl: null,
          notes: null,
          timerSeconds: task.timer_seconds,
          completionNote: null,
          completionFiles: [],
          completionLinks: [],
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
          startedAt: task.started_at?.toISOString() ?? null,
          completedAt: task.completed_at?.toISOString() ?? null,
          createdAt: task.created_at.toISOString(),
          updatedAt: task.updated_at.toISOString(),
          comments: [],
        }))}
      />
    </AppShell>
  );
}
