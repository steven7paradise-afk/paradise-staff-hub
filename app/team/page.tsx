import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, BarChart3, CalendarDays, CheckCircle2, Clock3, Mail, PieChart, Star, Timer, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AutoRefresh } from "@/components/auto-refresh";
import { TaskEvaluationActions } from "@/components/task-evaluation-actions";
import { Badge, Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

type CompletionFile = { name: string; url?: string | null };

function Avatar({ name, photoUrl, size = "size-24" }: { name: string; photoUrl: string | null; size?: string }) {
  return (
    <div className={`${size} grid shrink-0 place-items-center overflow-hidden rounded-full bg-paradise-softPink text-2xl font-bold`}>
      {photoUrl ? <img src={photoUrl} alt={name} className="size-full object-cover" /> : name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "Non impostata";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(value);
}

function formatTimer(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function weekStart(date = new Date()) {
  const start = new Date(date);
  const day = start.getDay() || 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day + 1);
  return start;
}

function normalizeFiles(value: unknown): CompletionFile[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return { name: item };
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      return { name: String(record.name ?? "file"), url: record.url ? String(record.url) : null };
    }
    return { name: "file" };
  });
}

function isImage(url?: string | null) {
  return Boolean(url && /^data:image\//i.test(url));
}

function evaluationPoints(value: string | null) {
  if (value === "LIKE") return 5;
  if (value === "OK") return 3;
  if (value === "DISLIKE") return 1;
  return null;
}

export default async function TeamPage({ searchParams }: { searchParams?: Promise<{ user?: string; task?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role as Role;
  if (!["SUPER_ADMIN", "ADMIN", "RESPONSABILE"].includes(role)) redirect("/dashboard");

  const params = await searchParams;
  const where = role === "RESPONSABILE"
    ? { active: true, sede_id: session.user.sedeId ?? undefined, role: { not: "SUPER_ADMIN" as const } }
    : { active: true, role: { not: "SUPER_ADMIN" as const } };

  const workers = await prisma.user.findMany({ where, include: { location: true }, orderBy: [{ location: { name: "asc" } }, { name: "asc" }] });
  const selectedId = params?.user ?? workers[0]?.id;
  const selected = workers.find((worker) => worker.id === selectedId) ?? workers[0];
  const start = weekStart();
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const [tasks, attendanceLogs] = selected
    ? await Promise.all([
        prisma.staffTask.findMany({
          where: role === "RESPONSABILE" ? { assigned_to_id: selected.id, location_id: session.user.sedeId ?? undefined } : { assigned_to_id: selected.id },
          include: { created_by: true, assigned_to: true },
          orderBy: { updated_at: "desc" },
        }),
        prisma.attendanceLog.findMany({
          where: { user_id: selected.id },
          orderBy: { timestamp: "desc" },
          take: 6,
        }),
      ])
    : [[], []];

  const selectedTask = tasks.find((task) => task.id === params?.task) ?? null;
  const completed = tasks.filter((task) => task.status === "COMPLETED");
  const active = tasks.filter((task) => task.status === "ACTIVE");
  const newTasks = tasks.filter((task) => task.status === "NEW");
  const completedWeek = completed.filter((task) => task.completed_at && task.completed_at >= start && task.completed_at < end);
  const createdWeek = tasks.filter((task) => task.created_at >= start && task.created_at < end);
  const evaluated = completed.map((task) => evaluationPoints(task.evaluation)).filter((value): value is 1 | 3 | 5 => value !== null);
  const avgRating = evaluated.length ? evaluated.reduce((total, value) => total + value, 0) / evaluated.length : 0;
  const dueCompleted = completed.filter((task) => task.due_date && task.completed_at);
  const punctuality = dueCompleted.length ? Math.round((dueCompleted.filter((task) => task.completed_at! <= task.due_date!).length / dueCompleted.length) * 100) : 100;
  const timedCompleted = completed.filter((task) => task.timer_seconds > 0);
  const averageSeconds = timedCompleted.length ? Math.round(timedCompleted.reduce((total, task) => total + task.timer_seconds, 0) / timedCompleted.length) : 0;
  const speedLabel = averageSeconds === 0 ? "Nessun tempo" : averageSeconds <= 3600 ? "Ottimo" : averageSeconds <= 7200 ? "Da seguire" : "Lento";
  const totalPie = Math.max(1, completedWeek.length + active.length + newTasks.length);
  const completedDeg = (completedWeek.length / totalPie) * 360;
  const activeDeg = completedDeg + (active.length / totalPie) * 360;
  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(day.getDate() + index);
    const assigned = createdWeek.filter((task) => task.created_at.toDateString() === day.toDateString()).length;
    const done = completedWeek.filter((task) => task.completed_at?.toDateString() === day.toDateString()).length;
    return { label: new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(day), assigned, done };
  });
  const maxWeek = Math.max(1, ...weekdays.flatMap((day) => [day.assigned, day.done]));

  return (
    <AppShell title="Team" subtitle="Panoramica personale e stato task aggiornato in tempo reale." role={role}>
      <AutoRefresh interval={12000} />
      <div className="grid gap-5 xl:grid-cols-[330px_1fr]">
        <Card className="bg-white">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-black/35">Personale task</p>
          <div className="grid max-h-[72dvh] gap-2 overflow-y-auto pr-1">
            {workers.map((worker) => (
              <Link key={worker.id} href={`/team?user=${worker.id}`} className={`flex items-center gap-3 rounded-2xl border p-3 transition ${selected?.id === worker.id ? "border-[#C66170]/35 bg-paradise-softPink/45" : "border-black/5 bg-white hover:bg-[#FBF7F9]"}`}>
                <Avatar name={worker.name} photoUrl={worker.photo_url} size="size-11" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{worker.name}</p>
                  <p className="truncate text-xs text-black/45">{worker.location?.name ?? "Senza salone"}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        {selected ? (
          <div className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-[1fr_2fr]">
              <Card className="bg-white">
                <div className="flex items-center gap-5">
                  <Avatar name={selected.name} photoUrl={selected.photo_url} />
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight">{selected.name}</h2>
                    <Badge tone="pink">{selected.location?.name ?? "Senza salone"}</Badge>
                    <p className="mt-3 flex items-center gap-2 text-sm text-black/55"><Mail className="size-4" /> {selected.email}</p>
                  </div>
                </div>
              </Card>
              <div className="grid gap-3 sm:grid-cols-4">
                <Card className="bg-white p-4"><CheckCircle2 className="size-5 text-emerald-600" /><p className="mt-4 text-3xl font-semibold">{completed.length}</p><p className="text-sm text-black/45">Task completate</p></Card>
                <Card className="bg-white p-4"><Clock3 className="size-5 text-[#8B78D6]" /><p className="mt-4 text-3xl font-semibold">{active.length}</p><p className="text-sm text-black/45">Task in corso</p></Card>
                <Card className="bg-white p-4"><Timer className="size-5 text-[#E2B719]" /><p className="mt-4 text-3xl font-semibold">{punctuality}%</p><p className="text-sm text-black/45">Puntualita</p></Card>
                <Card className="bg-white p-4"><Star className="size-5 text-[#C66170]" /><p className="mt-4 text-3xl font-semibold">{avgRating ? avgRating.toFixed(1) : "-"}</p><p className="text-sm text-black/45">Valutazione</p></Card>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
              <Card className="bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Riepilogo settimana</h3>
                  <Badge tone="pink">{completedWeek.length} completate</Badge>
                </div>
                <div className="mt-6 flex h-40 items-end gap-3 border-b border-black/10 pb-2">
                  {weekdays.map((day) => (
                    <div key={day.label} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-28 items-end gap-1">
                        <span className="w-3 rounded-t-full bg-[#8B78D6]" style={{ height: `${Math.max(4, (day.done / maxWeek) * 100)}%` }} />
                        <span className="w-3 rounded-t-full bg-black/15" style={{ height: `${Math.max(4, (day.assigned / maxWeek) * 100)}%` }} />
                      </div>
                      <span className="text-xs font-semibold capitalize text-black/45">{day.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-4 text-xs font-semibold text-black/50">
                  <span className="inline-flex items-center gap-2"><span className="size-3 rounded bg-[#8B78D6]" /> Completate</span>
                  <span className="inline-flex items-center gap-2"><span className="size-3 rounded bg-black/15" /> Assegnate</span>
                </div>
              </Card>

              <Card className="bg-white">
                <h3 className="font-semibold">Task</h3>
                <div className="mt-6 flex items-center gap-6">
                  <div className="grid size-36 place-items-center rounded-full" style={{ background: `conic-gradient(#42A85E 0deg ${completedDeg}deg, #8B78D6 ${completedDeg}deg ${activeDeg}deg, #E2B719 ${activeDeg}deg 360deg)` }}>
                    <div className="grid size-20 place-items-center rounded-full bg-white text-center">
                      <span className="text-2xl font-semibold">{completedWeek.length + active.length + newTasks.length}</span>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm font-semibold">
                    <p><span className="mr-2 inline-block size-3 rounded-full bg-[#42A85E]" /> Completate settimana {completedWeek.length}</p>
                    <p><span className="mr-2 inline-block size-3 rounded-full bg-[#8B78D6]" /> In corso {active.length}</p>
                    <p><span className="mr-2 inline-block size-3 rounded-full bg-[#E2B719]" /> Da fare {newTasks.length}</p>
                  </div>
                </div>
              </Card>

              <Card className="bg-white">
                <h3 className="font-semibold">Puntualita</h3>
                <p className="mt-6 text-5xl font-semibold">{punctuality}%</p>
                <p className="mt-2 text-sm text-black/50">Regola: completata entro scadenza.</p>
                <div className="mt-6 rounded-2xl bg-[#FBF7F9] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">Tempo medio</p>
                  <p className="mt-2 text-2xl font-semibold">{averageSeconds ? formatTimer(averageSeconds) : "--"}</p>
                  <Badge tone={speedLabel === "Ottimo" ? "green" : speedLabel === "Da seguire" ? "gold" : "pink"}>{speedLabel}</Badge>
                </div>
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
              <Card className="bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Ultime task</h3>
                  <PieChart className="size-5 text-black/35" />
                </div>
                <div className="mt-4 divide-y divide-black/5">
                  {tasks.slice(0, 7).map((task) => (
                    <Link key={task.id} href={`/team?user=${selected.id}&task=${task.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3">
                      <span className="grid size-8 place-items-center rounded-full bg-[#F4F0FF]"><UserRound className="size-4" /></span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{task.title}</p>
                        <p className="text-xs text-black/45">Da {task.created_by.name} · {formatDate(task.due_date)} · {task.timer_seconds ? formatTimer(task.timer_seconds) : "timer non avviato"}</p>
                      </div>
                      <Badge tone={task.status === "COMPLETED" ? "green" : task.status === "ACTIVE" ? "gold" : "pink"}>{task.status === "COMPLETED" ? "Completata" : task.status === "ACTIVE" ? "In corso" : "Da iniziare"}</Badge>
                    </Link>
                  ))}
                  {tasks.length === 0 ? <p className="py-4 text-sm text-black/45">Nessuna task presente.</p> : null}
                </div>
              </Card>

              <Card className="bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Attivita recente</h3>
                  <Activity className="size-5 text-black/35" />
                </div>
                <div className="mt-4 space-y-3">
                  {tasks.slice(0, 4).map((task) => (
                    <div key={task.id} className="rounded-2xl bg-[#FBF7F9] p-4">
                      <p className="text-sm font-semibold">{task.status === "COMPLETED" ? "Ha completato" : "Ha ricevuto"} la task “{task.title}”</p>
                      <p className="mt-1 text-xs text-black/45">{formatDate(task.updated_at)}</p>
                    </div>
                  ))}
                  {attendanceLogs.map((log) => (
                    <div key={log.id} className="rounded-2xl bg-[#FBF7F9] p-4">
                      <p className="text-sm font-semibold">Timbratura {log.type.toLowerCase()}</p>
                      <p className="mt-1 text-xs text-black/45">{formatDate(log.timestamp)}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {selectedTask ? (
              <Card className="bg-white">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">Dettaglio task</p>
                    <h3 className="mt-2 text-3xl font-semibold">{selectedTask.title}</h3>
                    <p className="mt-3 max-w-3xl leading-7 text-black/55">{selectedTask.description}</p>
                  </div>
                  <Badge tone={selectedTask.status === "COMPLETED" ? "green" : selectedTask.status === "ACTIVE" ? "gold" : "pink"}>{selectedTask.status === "COMPLETED" ? "Completata" : selectedTask.status === "ACTIVE" ? "In corso" : "Da iniziare"}</Badge>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-[#FBF7F9] p-4"><p className="text-xs text-black/40">Richiesto da</p><p className="font-semibold">{selectedTask.created_by.name}</p></div>
                  <div className="rounded-2xl bg-[#FBF7F9] p-4"><p className="text-xs text-black/40">Scadenza</p><p className="font-semibold">{formatDate(selectedTask.due_date)}</p></div>
                  <div className="rounded-2xl bg-[#FBF7F9] p-4"><p className="text-xs text-black/40">Tempo impiegato</p><p className="font-semibold">{selectedTask.timer_seconds ? formatTimer(selectedTask.timer_seconds) : "--"}</p></div>
                </div>
                {(selectedTask.completion_note || selectedTask.completion_files || selectedTask.completion_links) ? (
                  <div className="mt-6 rounded-[24px] border border-black/5 p-4">
                    <h4 className="font-semibold">Cosa ha finito</h4>
                    {selectedTask.completion_note ? <p className="mt-3 leading-7 text-black/55">{selectedTask.completion_note}</p> : null}
                    <div className="mt-4 grid gap-3">
                      {normalizeFiles(selectedTask.completion_files).map((file, index) => (
                        <div key={`${file.name}-${index}`} className="rounded-2xl bg-[#FAF7F9] p-3">
                          {isImage(file.url) ? <img src={file.url!} alt={file.name} className="max-h-96 w-full rounded-xl object-contain" /> : null}
                          <p className="mt-2 text-sm font-semibold text-black/60">{file.name}</p>
                        </div>
                      ))}
                      {Array.isArray(selectedTask.completion_links) ? selectedTask.completion_links.map((link) => <a key={String(link)} href={String(link)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#8064D8]">{String(link)}</a>) : null}
                    </div>
                  </div>
                ) : null}
                <div className="mt-6">
                  <p className="mb-3 text-sm font-semibold">Valutazione responsabile</p>
                  <TaskEvaluationActions taskId={selectedTask.id} initialValue={selectedTask.evaluation} />
                </div>
              </Card>
            ) : null}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
