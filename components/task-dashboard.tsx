"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileImage,
  Flag,
  Kanban,
  LayoutDashboard,
  LinkIcon,
  ListChecks,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Send,
  SlidersHorizontal,
  Tag,
  Timer,
  Table2,
  UserRound,
  X,
} from "lucide-react";
import { Badge, Button, Card, Field, Select } from "@/components/ui";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

type Worker = { id: string; name: string; locationId: string | null; photoUrl: string | null };
type ChecklistItem = { text: string; done: boolean };
type CompletionFile = { name: string; url?: string | null };
type Task = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  checklist: ChecklistItem[];
  attachmentName: string | null;
  attachmentUrl: string | null;
  photoUrl: string | null;
  linkUrl: string | null;
  notes: string | null;
  timerSeconds: number;
  completionNote: string | null;
  completionFiles: CompletionFile[];
  completionLinks: string[];
  evaluation?: string | null;
  comments: TaskComment[];
  locationId: string;
  locationName: string;
  assignedToId: string;
  assignedToName: string;
  assignedToPhoto: string | null;
  createdByName: string;
  createdById: string;
  createdByPhoto: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};
type TaskComment = { id: string; message: string; userId: string; userName: string; userPhoto: string | null; createdAt: string; updatedAt: string };
type TaskView = "HOME" | "TABLE" | "BOARD" | "CALENDAR" | "LIST";
type TaskFilter = "TODAY" | "ACTIVE" | "NEW" | "WAITING" | "COMPLETED";
type AttachmentPreview = { name: string; url: string; kind: "image" | "file" };

function isNewTask(task: Task) {
  return task.status === "NEW";
}

function normalizedStatus(status: string) {
  return status.trim().toUpperCase().replace(/[-\s]/g, "_");
}

function isCompletedTask(task: Task) {
  return ["COMPLETED", "DONE"].includes(normalizedStatus(task.status));
}

function isActiveTask(task: Task) {
  return normalizedStatus(task.status) === "ACTIVE";
}

function isWaitingTask(task: Task) {
  return ["WAITING", "ON_HOLD", "HOLD", "PENDING", "IN_ATTESA"].includes(normalizedStatus(task.status));
}

function isTodayTask(task: Task) {
  const source = taskCalendarDate(task);
  const date = new Date(source);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function taskCalendarDate(task: Task) {
  return task.dueDate ?? task.createdAt;
}

function localDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function startOfWeek(date: Date) {
  const week = new Date(date);
  week.setHours(0, 0, 0, 0);
  week.setDate(week.getDate() - week.getDay());
  return week;
}

function statusLabel(status: string) {
  if (["COMPLETED", "DONE"].includes(normalizedStatus(status))) return "Completata";
  if (normalizedStatus(status) === "ACTIVE") return "In corso";
  if (isWaitingTask({ status } as Task)) return "In attesa";
  return "Da iniziare";
}

function formatCategoryLabel(value: string) {
  const clean = (value || "Operativa").trim().replace(/[_/|-]+/g, " ").replace(/\s+/g, " ");
  const knownPrefixes = ["Operativa", "Reception", "Sala", "Bar", "Cucina", "Pulizia", "Magazzino", "Clienti"];
  const prefix = knownPrefixes.find((item) => clean.toLowerCase().startsWith(item.toLowerCase()) && clean.length > item.length);
  if (!prefix) return clean;
  const rest = clean.slice(prefix.length).trim();
  if (!rest) return prefix;
  return `${prefix} · ${rest.charAt(0).toUpperCase()}${rest.slice(1)}`;
}

function formatTaskDate(value: string | null) {
  if (!value) return "Oggi";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(new Date(value));
}

function formatShortDateTime(value: string | null) {
  if (!value) return "Non impostata";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatFullDate(value: string | null) {
  if (!value) return "Oggi, 23:59";
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function Avatar({ name, photoUrl, className = "size-8" }: { name: string; photoUrl: string | null; className?: string }) {
  return (
    <div className={`${className} grid shrink-0 place-items-center overflow-hidden rounded-full bg-paradise-softPink text-xs font-bold text-paradise-noir`}>
      {photoUrl ? <img src={photoUrl} alt={name} className="size-full object-cover" /> : name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function priorityTone(priority: string): "pink" | "gold" | "green" {
  if (priority === "ALTA") return "pink";
  if (priority === "BASSA") return "green";
  return "gold";
}

function statusClasses(status: string) {
  if (["COMPLETED", "DONE"].includes(normalizedStatus(status))) return "bg-emerald-100 text-emerald-800";
  if (normalizedStatus(status) === "ACTIVE") return "bg-orange-100 text-orange-800";
  if (isWaitingTask({ status } as Task)) return "bg-violet-100 text-violet-800";
  return "bg-blue-100 text-blue-800";
}

function calendarClasses(task: Task) {
  if (task.priority === "ALTA" && !isCompletedTask(task)) return "border-red-200 bg-red-50 text-red-700";
  if (isCompletedTask(task)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (isActiveTask(task)) return "border-orange-200 bg-orange-50 text-orange-800";
  if (isWaitingTask(task)) return "border-violet-200 bg-violet-50 text-violet-800";
  return "border-blue-200 bg-blue-50 text-blue-800";
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function isImageName(name?: string | null) {
  return Boolean(name && /\.(png|jpe?g|webp|gif|avif)$/i.test(name));
}

function isPreviewableImage(url?: string | null) {
  return Boolean(url && (/^data:image\//i.test(url) || /^https?:\/\//i.test(url)));
}

function attachmentKind(url?: string | null, name?: string | null): AttachmentPreview["kind"] {
  return isPreviewableImage(url) || isImageName(name) ? "image" : "file";
}

function MissingImagePreview({ name }: { name: string }) {
  return (
    <div className="mt-3 rounded-2xl border border-dashed border-black/15 bg-[#FAF7F9] p-4 text-sm text-black/55">
      <p className="font-semibold text-black/70">{name}</p>
      <p className="mt-1">Anteprima non disponibile: questo file ha salvato solo il nome. Ricarica l'immagine per vederla qui.</p>
    </div>
  );
}

function formatTimer(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function TaskDashboard({ role, userId, userName, workers, categories: initialCategories, initialTasks }: { role: Role; userId: string; userName: string; workers: Worker[]; categories: string[]; initialTasks: Task[] }) {
  const canAssign = role === "SUPER_ADMIN" || role === "ADMIN" || role === "RESPONSABILE";
  
  const currentUserSedeId = workers.find((w) => w.id === userId)?.locationId ?? null;
  const initialAllowedWorkers = (role === "SUPER_ADMIN" || role === "ADMIN")
    ? workers
    : currentUserSedeId
      ? workers.filter((w) => w.locationId === currentUserSedeId)
      : [];

  const [tasks, setTasks] = useState(initialTasks);
  const [view, setView] = useState<TaskView>("HOME");
  const [open, setOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Task | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("ACTIVE");
  const [assignmentFilter, setAssignmentFilter] = useState<"ALL" | "ASSIGNED_TO_ME" | "ASSIGNED_BY_ME">("ALL");
  const [attachmentPreview, setAttachmentPreview] = useState<AttachmentPreview | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<"updated" | "due" | "priority" | "title">("updated");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [calendarMode, setCalendarMode] = useState<"MONTH" | "WEEK">("MONTH");
  const [saving, setSaving] = useState(false);
  const [formStatus, setFormStatus] = useState("");
  const [completionOpen, setCompletionOpen] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [completion, setCompletion] = useState({ note: "", link: "", files: [] as CompletionFile[] });
  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedToId: initialAllowedWorkers[0]?.id ?? "",
    priority: "MEDIA",
    category: "Operativa",
    dueDate: "",
    linkUrl: "",
    attachmentName: "",
    photoUrl: "",
    checklistText: "",
  });

  const baseTasks = useMemo(() => {
    return (canAssign || role === "DIPENDENTE") ? tasks : tasks.filter((task) => task.assignedToId === userId);
  }, [tasks, canAssign, role, userId]);

  const personalTasks = useMemo(() => {
    if (assignmentFilter === "ASSIGNED_TO_ME") {
      return baseTasks.filter((task) => task.assignedToId === userId);
    }
    if (assignmentFilter === "ASSIGNED_BY_ME") {
      return baseTasks.filter((task) => task.createdById === userId);
    }
    return baseTasks;
  }, [baseTasks, assignmentFilter, userId]);

  const activeTasks = personalTasks.filter(isActiveTask);
  const completedTasks = personalTasks.filter(isCompletedTask);
  const newTasks = personalTasks.filter(isNewTask);
  const waitingTasks = personalTasks.filter(isWaitingTask);
  const openTasks = personalTasks.filter((task) => !isCompletedTask(task));
  const todayTasks = openTasks.filter(isTodayTask);
  const visibleTasks = filter === "TODAY" ? todayTasks : filter === "COMPLETED" ? completedTasks : filter === "WAITING" ? waitingTasks : filter === "NEW" ? newTasks : activeTasks;
  const featuredTask = todayTasks[0] ?? activeTasks[0] ?? newTasks[0] ?? null;
  const completedChecklist = selected?.checklist.filter((item) => item.done).length ?? 0;
  const categories = Array.from(new Set([...initialCategories, ...tasks.map((task) => task.category).filter(Boolean)]));
  const selectedWorker = initialAllowedWorkers.find((worker) => worker.id === form.assignedToId) ?? initialAllowedWorkers[0] ?? null;
  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const priorityRank: Record<string, number> = { ALTA: 0, MEDIA: 1, BASSA: 2 };
    return personalTasks
      .filter((task) => {
        const matchesQuery = !query || [task.title, task.description, task.assignedToName, task.category, task.locationName].some((value) => value?.toLowerCase().includes(query));
        const matchesStatus = statusFilter === "ALL" || statusLabel(task.status).toUpperCase() === statusFilter;
        const matchesPriority = priorityFilter === "ALL" || task.priority === priorityFilter;
        return matchesQuery && matchesStatus && matchesPriority;
      })
      .sort((a, b) => {
        if (sortKey === "title") return a.title.localeCompare(b.title);
        if (sortKey === "priority") return (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
        if (sortKey === "due") return new Date(a.dueDate ?? "2999-12-31").getTime() - new Date(b.dueDate ?? "2999-12-31").getTime();
        return new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime();
      });
  }, [personalTasks, priorityFilter, searchQuery, sortKey, statusFilter]);
  const urgentTask = openTasks.find((task) => task.priority === "ALTA") ?? null;
  const expiringTasks = openTasks
    .filter((task) => task.dueDate)
    .sort((a, b) => new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime())
    .slice(0, 4);
  const recentComments = personalTasks.flatMap((task) => task.comments.map((comment) => ({ ...comment, taskTitle: task.title, taskId: task.id })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);
  const recentActivity = personalTasks
    .slice()
    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())
    .slice(0, 5);

  const metrics = useMemo(
    () => [
      { label: "Tasks di oggi", value: todayTasks.length, icon: CalendarDays, color: "text-[#C66170]" },
      { label: "In corso", value: activeTasks.length, icon: ListChecks, color: "text-[#8B78D6]" },
      { label: "Da iniziare", value: newTasks.length, icon: Clock3, color: "text-[#E2B719]" },
      { label: "Completate", value: completedTasks.length, icon: CheckCircle2, color: "text-[#42A85E]" },
      { label: "In attesa", value: waitingTasks.length, icon: Timer, color: "text-[#9B80DE]" },
    ],
    [activeTasks, completedTasks.length, newTasks.length, todayTasks.length, waitingTasks.length],
  );

  async function createTask() {
    setSaving(true);
    setFormStatus("Invio task e notifica al lavoratore...");
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        checklist: form.checklistText.split("\n"),
      }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setFormStatus(data.error ?? "Task non inviata. Controlla i campi.");
      return;
    }
    setTasks((current) => [
      {
        id: data.id,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        category: data.category ?? "Operativa",
        checklist: Array.isArray(data.checklist) ? data.checklist : [],
        attachmentName: data.attachment_name ?? null,
        attachmentUrl: data.attachment_url ?? null,
        photoUrl: data.photo_url ?? null,
        linkUrl: data.link_url ?? null,
        notes: data.notes ?? null,
        timerSeconds: data.timer_seconds ?? 0,
        completionNote: data.completion_note ?? null,
        completionFiles: normalizeCompletionFiles(data.completion_files),
        completionLinks: Array.isArray(data.completion_links) ? data.completion_links : [],
        evaluation: data.evaluation ?? null,
        comments: Array.isArray(data.comments) ? data.comments.map((comment: any) => ({
          id: comment.id,
          message: comment.message,
          userId: comment.user_id,
          userName: comment.user.name,
          userPhoto: comment.user.photo_url ?? null,
          createdAt: comment.created_at,
          updatedAt: comment.updated_at,
        })) : [],
        locationId: data.location_id,
        locationName: data.location?.name ?? "Salone",
        assignedToId: data.assigned_to_id,
        assignedToName: data.assigned_to.name,
        assignedToPhoto: data.assigned_to.photo_url ?? null,
        createdByName: data.created_by.name,
        createdById: data.created_by_id,
        createdByPhoto: data.created_by.photo_url ?? null,
        dueDate: data.due_date,
        createdAt: data.created_at,
        updatedAt: data.updated_at ?? data.created_at,
      },
      ...current,
    ]);
    setFormStatus(`Task inviata a ${data.assigned_to.name}. Notifica creata.`);
    setTimeout(() => {
      setForm({ title: "", description: "", assignedToId: initialAllowedWorkers[0]?.id ?? "", priority: "MEDIA", category: "Operativa", dueDate: "", linkUrl: "", attachmentName: "", photoUrl: "", checklistText: "" });
      setFormStatus("");
      setOpen(false);
    }, 900);
  }

  function resetTaskForm() {
    setForm({ title: "", description: "", assignedToId: initialAllowedWorkers[0]?.id ?? "", priority: "MEDIA", category: "Operativa", dueDate: "", linkUrl: "", attachmentName: "", photoUrl: "", checklistText: "" });
    setEditingTaskId(null);
    setFormStatus("");
    setOpen(false);
  }

  function openEditTask(task: Task) {
    setEditingTaskId(task.id);
    setFormStatus("");
    setForm({
      title: task.title,
      description: task.description,
      assignedToId: task.assignedToId,
      priority: task.priority,
      category: task.category,
      dueDate: toDateTimeLocal(task.dueDate),
      linkUrl: task.linkUrl ?? "",
      attachmentName: task.attachmentName ?? "",
      photoUrl: task.photoUrl ?? "",
      checklistText: task.checklist.map((item) => item.text).join("\n"),
    });
    setOpen(true);
  }

  async function saveTaskEdit() {
    if (!editingTaskId) return;
    setSaving(true);
    const response = await fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingTaskId, ...form, checklist: form.checklistText.split("\n") }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) return;
    const mapped = mapApiTask(data);
    setTasks((current) => current.map((task) => task.id === editingTaskId ? mapped : task));
    if (selected?.id === editingTaskId) setSelected(mapped);
    resetTaskForm();
  }

  async function attachPhoto(file: File | undefined) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setForm((current) => ({ ...current, attachmentName: file.name, photoUrl: dataUrl }));
  }

  async function attachMainFile(file: File | undefined) {
    if (!file) return;
    if (file.type.startsWith("image/")) {
      await attachPhoto(file);
      return;
    }
    setForm((current) => ({ ...current, attachmentName: file.name }));
  }

  useEffect(() => {
    setTimerRunning(false);
    setTimerPaused(false);
  }, [selected?.id]);

  useEffect(() => {
    if (!selected || selected.status !== "ACTIVE" || !timerRunning || timerPaused) return;
    const interval = window.setInterval(() => {
      setSelected((current) => current ? { ...current, timerSeconds: current.timerSeconds + 1 } : current);
      setTasks((current) => current.map((item) => item.id === selected.id ? { ...item, timerSeconds: item.timerSeconds + 1 } : item));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [selected?.id, selected?.status, timerRunning, timerPaused]);

  async function updateStatus(task: Task, status: "ACTIVE" | "COMPLETED", extra?: { completionNote?: string; completionLinks?: string[]; completionFiles?: CompletionFile[] }) {
    const nextTask = { ...task, status, timerSeconds: task.timerSeconds };
    setTasks((current) => current.map((item) => (item.id === task.id ? nextTask : item)));
    if (selected?.id === task.id) setSelected(nextTask);
    const response = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, status, timerSeconds: task.timerSeconds, ...extra }),
    });
    if (response.ok) {
      const data = await response.json();
      const mapped = mapApiTask(data);
      setTasks((current) => current.map((item) => (item.id === task.id ? mapped : item)));
      if (selected?.id === task.id) setSelected(mapped);
    }
  }

  function mapApiTask(data: any): Task {
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      category: data.category ?? "Operativa",
      checklist: Array.isArray(data.checklist) ? data.checklist : [],
      attachmentName: data.attachment_name ?? null,
      attachmentUrl: data.attachment_url ?? null,
      photoUrl: data.photo_url ?? null,
      linkUrl: data.link_url ?? null,
      notes: data.notes ?? null,
      timerSeconds: data.timer_seconds ?? 0,
      completionNote: data.completion_note ?? null,
      completionFiles: normalizeCompletionFiles(data.completion_files),
      completionLinks: Array.isArray(data.completion_links) ? data.completion_links : [],
      evaluation: data.evaluation ?? null,
      locationId: data.location_id,
      locationName: data.location?.name ?? "Salone",
      assignedToId: data.assigned_to_id,
      assignedToName: data.assigned_to.name,
      assignedToPhoto: data.assigned_to.photo_url ?? null,
      createdByName: data.created_by.name,
      createdById: data.created_by_id,
      createdByPhoto: data.created_by.photo_url ?? null,
      dueDate: data.due_date,
      createdAt: data.created_at,
      updatedAt: data.updated_at ?? data.created_at,
      comments: Array.isArray(data.comments) ? data.comments.map((comment: any) => ({
        id: comment.id,
        message: comment.message,
        userId: comment.user_id,
        userName: comment.user.name,
        userPhoto: comment.user.photo_url ?? null,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
      })) : [],
    };
  }

  function normalizeCompletionFiles(value: unknown): CompletionFile[] {
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

  async function attachCompletionFiles(files: FileList | null) {
    const next: CompletionFile[] = [];
    for (const file of Array.from(files ?? [])) {
      if (file.type.startsWith("image/")) {
        next.push({ name: file.name, url: await fileToDataUrl(file) });
      } else {
        next.push({ name: file.name });
      }
    }
    setCompletion((current) => ({ ...current, files: next }));
  }

  async function saveComment() {
    if (!selected || !commentText.trim()) return;
    const isEdit = Boolean(editingCommentId);
    const response = await fetch("/api/tasks/comments", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEdit ? { id: editingCommentId, message: commentText } : { taskId: selected.id, message: commentText }),
    });
    if (!response.ok) return;
    const data = await response.json();
    const comment: TaskComment = {
      id: data.id,
      message: data.message,
      userId: data.user_id,
      userName: data.user.name,
      userPhoto: data.user.photo_url ?? null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
    const comments = isEdit
      ? selected.comments.map((item) => item.id === comment.id ? comment : item)
      : [...selected.comments, comment];
    const updated = { ...selected, comments };
    setSelected(updated);
    setTasks((current) => current.map((item) => item.id === selected.id ? updated : item));
    setCommentText("");
    setEditingCommentId(null);
  }

  function AttachmentCard({ name, url }: { name: string; url?: string | null }) {
    const kind = attachmentKind(url, name);
    if (!url && isImageName(name)) return <MissingImagePreview name={name} />;

    return (
      <div className="rounded-[22px] border border-black/10 bg-[#FAF7F9] p-3">
        <div className="flex items-center gap-3">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
            {kind === "image" && url ? (
              <img src={url} alt={name} className="size-full object-cover" />
            ) : (
              <Paperclip className="size-6 text-black/45" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-black/70">{name}</p>
            <p className="mt-1 text-xs text-black/40">{kind === "image" ? "Immagine allegata" : "File allegato"}</p>
          </div>
          <Button
            type="button"
            variant="soft"
            disabled={!url}
            onClick={() => url && setAttachmentPreview({ name, url, kind })}
          >
            Apri allegato
          </Button>
        </div>
      </div>
    );
  }

  function TaskRow({ task }: { task: Task }) {
    return (
      <button onClick={() => setSelected(task)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm md:grid-cols-[auto_1fr_120px_130px_90px]">
        <span className="grid size-5 place-items-center rounded-md border border-black/20">
          {task.status === "COMPLETED" ? <Check className="size-3" /> : null}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{task.title}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-black/45">
            <Avatar name={task.assignedToName} photoUrl={task.assignedToPhoto} className="size-5" />
            <span className="truncate">{task.assignedToName}</span>
            <span>·</span>
            <span>{formatTaskDate(task.dueDate)}</span>
          </div>
        </div>
        <span className="hidden text-sm font-medium text-black/55 md:block">{formatCategoryLabel(task.category)}</span>
        <span className="hidden text-sm font-semibold text-black/55 md:block">{statusLabel(task.status)}</span>
        <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
      </button>
    );
  }

  function toggleTaskSelection(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  const viewTabs: { id: TaskView; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "HOME", label: "Home", icon: LayoutDashboard },
    { id: "TABLE", label: "Tabella", icon: Table2 },
    { id: "BOARD", label: "Board", icon: Kanban },
    { id: "CALENDAR", label: "Calendario", icon: CalendarDays },
    { id: "LIST", label: "Lista", icon: ListChecks },
  ];
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const calendarStart = calendarMode === "WEEK" ? startOfWeek(today) : monthStart;
  const calendarCells = Array.from({ length: calendarMode === "WEEK" ? 7 : 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarMode === "WEEK" ? calendarStart.getDate() + index : index - monthStart.getDay() + 1);
    return date;
  });
  const weekEnd = new Date(calendarStart);
  weekEnd.setDate(calendarStart.getDate() + 6);
  const calendarTitle = calendarMode === "WEEK"
    ? `${new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(calendarStart)} - ${new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(weekEnd)}`
    : new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(monthStart);
  const listSections: { filter: TaskFilter; label: string; tasks: Task[]; color: string }[] = [
    { filter: "TODAY", label: "Tasks di oggi", tasks: todayTasks, color: "text-[#C66170]" },
    { filter: "ACTIVE", label: "In corso", tasks: activeTasks, color: "text-[#8B78D6]" },
    { filter: "NEW", label: "Da iniziare", tasks: newTasks, color: "text-[#E2B719]" },
    { filter: "WAITING", label: "In attesa", tasks: waitingTasks, color: "text-[#9B80DE]" },
    { filter: "COMPLETED", label: "Completate", tasks: completedTasks, color: "text-[#42A85E]" },
  ];
  const boardColumns = [
    { label: "Da fare", tasks: filteredTasks.filter(isNewTask), color: "bg-[#FFF4F8]", text: "text-[#C66170]", filter: "NEW" as TaskFilter },
    { label: "In corso", tasks: filteredTasks.filter(isActiveTask), color: "bg-[#F5F1FF]", text: "text-[#8064D8]", filter: "ACTIVE" as TaskFilter },
    { label: "In attesa", tasks: filteredTasks.filter(isWaitingTask), color: "bg-[#FFF9EA]", text: "text-[#B66B11]", filter: "WAITING" as TaskFilter },
    { label: "Completate", tasks: filteredTasks.filter(isCompletedTask), color: "bg-[#EFFAF2]", text: "text-[#2D8C43]", filter: "COMPLETED" as TaskFilter },
  ];

  return (
    <div className="w-full max-w-none space-y-6">
      <div className="rounded-[32px] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/35">{view === "HOME" ? "Paradise Staff Hub" : "Task"}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">{view === "HOME" ? `Ciao ${userName.split(" ")[0]}` : "TASK"}</h1>
            <p className="mt-2 text-sm text-black/50">{view === "HOME" ? "Ecco cosa c'e da fare oggi." : "Gestisci e organizza tutte le attivita del team."}</p>
          </div>
          <div className="flex items-center gap-3">
            {canAssign || role === "DIPENDENTE" ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex min-h-14 flex-1 items-center justify-center gap-3 rounded-[22px] bg-paradise-noir px-6 py-4 text-base font-bold text-white shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-xl lg:flex-none"
              >
                <Plus className="size-5" />
                Aggiungi task
              </button>
            ) : null}
            <div className="relative grid size-14 place-items-center rounded-2xl bg-paradise-softPink">
              <Bell className="size-5" />
              {openTasks.length > 0 ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#C66170] px-1 text-center text-xs font-bold text-white">{openTasks.length}</span> : null}
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-2 border-b border-black/5 pb-4">
          {viewTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold transition ${view === tab.id ? "bg-paradise-softPink text-[#C66170]" : "text-black/50 hover:bg-black/5"}`}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-black/[0.03] p-1 dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={() => setAssignmentFilter("ALL")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-200 active:scale-95 ${
                assignmentFilter === "ALL"
                  ? "bg-white text-paradise-noir shadow-sm border border-black/5 dark:bg-white/10 dark:text-white dark:border-white/5"
                  : "text-black/50 hover:text-black hover:bg-black/5 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5"
              }`}
            >
              Tutte le task ({baseTasks.length})
            </button>
            <button
              type="button"
              onClick={() => setAssignmentFilter("ASSIGNED_TO_ME")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-200 active:scale-95 ${
                assignmentFilter === "ASSIGNED_TO_ME"
                  ? "bg-white text-paradise-noir shadow-sm border border-black/5 dark:bg-white/10 dark:text-white dark:border-white/5"
                  : "text-black/50 hover:text-black hover:bg-black/5 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5"
              }`}
            >
              Assegnate a me ({baseTasks.filter((t) => t.assignedToId === userId).length})
            </button>
            <button
              type="button"
              onClick={() => setAssignmentFilter("ASSIGNED_BY_ME")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-200 active:scale-95 ${
                assignmentFilter === "ASSIGNED_BY_ME"
                  ? "bg-white text-paradise-noir shadow-sm border border-black/5 dark:bg-white/10 dark:text-white dark:border-white/5"
                  : "text-black/50 hover:text-black hover:bg-black/5 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5"
              }`}
            >
              Assegnate da me ({baseTasks.filter((t) => t.createdById === userId).length})
            </button>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-5">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="rounded-[22px] border border-black/5 bg-white p-4 shadow-sm">
                <Icon className={`size-6 ${metric.color}`} />
                <p className="mt-5 text-3xl font-semibold">{metric.value}</p>
                <p className="mt-1 text-sm text-black/50">{metric.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {view === "HOME" ? (
        <>
          {urgentTask ? (
          <button onClick={() => setSelected(urgentTask)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 rounded-[28px] border border-red-200 bg-red-50 p-5 text-left shadow-sm">
            <div className="grid size-16 place-items-center rounded-full bg-[#E7DDFE] text-[#8064D8]">
              <Flag className="size-7 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">Task urgente</p>
              <h2 className="mt-2 truncate text-2xl font-semibold">{urgentTask.title}</h2>
              <p className="mt-1 truncate text-sm text-black/55">Scadenza {formatShortDateTime(urgentTask.dueDate)} · {urgentTask.locationName}</p>
            </div>
            <div className="grid size-14 place-items-center rounded-full bg-white shadow-sm">
              <ArrowRight className="size-6" />
            </div>
          </button>
          ) : null}
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="bg-white">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Le mie task</h2>
                <button type="button" onClick={() => setView("LIST")} className="text-sm font-bold text-[#C66170]">Vedi lista</button>
              </div>
              <div className="grid gap-3">
                {todayTasks.length === 0 ? <p className="rounded-2xl bg-[#FAF7F9] p-4 text-sm text-black/45">Nessuna task di oggi ancora aperta.</p> : null}
                {todayTasks.slice(0, 5).map((task) => <TaskRow key={task.id} task={task} />)}
              </div>
            </Card>
            <Card className="bg-white">
              <h2 className="text-2xl font-semibold">Task in scadenza</h2>
              <div className="mt-5 grid gap-3">
                {expiringTasks.length === 0 ? <p className="rounded-2xl bg-[#FAF7F9] p-4 text-sm text-black/45">Nessuna scadenza aperta.</p> : null}
                {expiringTasks.map((task) => (
                  <button key={task.id} onClick={() => setSelected(task)} className="flex items-center justify-between rounded-2xl border border-black/5 p-4 text-left">
                    <div>
                      <p className="font-semibold">{task.title}</p>
                      <p className="text-sm text-black/45">{formatShortDateTime(task.dueDate)}</p>
                    </div>
                    <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
                  </button>
                ))}
              </div>
            </Card>
            <Card className="bg-white">
              <h2 className="text-2xl font-semibold">Ultime attivita</h2>
              <div className="mt-5 grid gap-3">
                {recentActivity.map((task) => (
                  <button key={task.id} onClick={() => setSelected(task)} className="flex items-center gap-3 rounded-2xl bg-[#FAF7F9] p-4 text-left">
                    <span className={`size-3 rounded-full ${isCompletedTask(task) ? "bg-emerald-500" : isActiveTask(task) ? "bg-orange-500" : "bg-violet-500"}`} />
                    <div>
                      <p className="font-semibold">{task.title}</p>
                      <p className="text-sm text-black/45">{statusLabel(task.status)} · {formatShortDateTime(task.updatedAt)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
            <Card className="bg-white">
              <h2 className="text-2xl font-semibold">Commenti recenti</h2>
              <div className="mt-5 grid gap-3">
                {recentComments.length === 0 ? <p className="rounded-2xl bg-[#FAF7F9] p-4 text-sm text-black/45">Nessun commento recente.</p> : null}
                {recentComments.map((comment) => (
                  <button key={comment.id} onClick={() => setSelected(personalTasks.find((task) => task.id === comment.taskId) ?? null)} className="flex items-start gap-3 rounded-2xl border border-black/5 p-4 text-left">
                    <Avatar name={comment.userName} photoUrl={comment.userPhoto} />
                    <div className="min-w-0">
                      <p className="font-semibold">{comment.userName}</p>
                      <p className="truncate text-sm text-black/55">{comment.taskTitle}: {comment.message}</p>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </>
      ) : null}

      {view === "TABLE" ? (
        <Card className="overflow-hidden bg-white p-0">
          <div className="flex flex-col gap-3 border-b border-black/5 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 items-center gap-2 rounded-2xl border border-black/10 px-3 py-2">
              <Search className="size-4 text-black/35" />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cerca task..." className="w-full bg-transparent text-sm outline-none" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-auto min-w-36"><option value="ALL">Tutti stati</option><option value="IN CORSO">In corso</option><option value="DA INIZIARE">Da iniziare</option><option value="IN ATTESA">In attesa</option><option value="COMPLETATA">Completate</option></Select>
              <Select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="w-auto min-w-32"><option value="ALL">Priorita</option><option value="ALTA">Alta</option><option value="MEDIA">Media</option><option value="BASSA">Bassa</option></Select>
              <Select value={sortKey} onChange={(event) => setSortKey(event.target.value as typeof sortKey)} className="w-auto min-w-32"><option value="updated">Aggiornate</option><option value="due">Scadenza</option><option value="priority">Priorita</option><option value="title">Titolo</option></Select>
              <Button variant="soft"><SlidersHorizontal className="size-4" /> Filtra</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-black/5 text-xs uppercase tracking-[0.12em] text-black/35">
                <tr>
                  <th className="px-4 py-4"><input type="checkbox" checked={filteredTasks.length > 0 && selectedIds.length === filteredTasks.length} onChange={(event) => setSelectedIds(event.target.checked ? filteredTasks.map((task) => task.id) : [])} /></th>
                  <th className="px-4 py-4">Nome task</th>
                  <th className="px-4 py-4">Stato</th>
                  <th className="px-4 py-4">Priorita</th>
                  <th className="px-4 py-4">Assegnato a</th>
                  <th className="px-4 py-4">Categoria</th>
                  <th className="px-4 py-4">Scadenza</th>
                  <th className="px-4 py-4">Salone</th>
                  <th className="px-4 py-4">Ultimo aggiornamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filteredTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-[#FAF7F9]">
                    <td className="px-4 py-4"><input type="checkbox" checked={selectedIds.includes(task.id)} onChange={() => toggleTaskSelection(task.id)} /></td>
                    <td className="cursor-pointer px-4 py-4 font-semibold" onClick={() => setSelected(task)}>{task.title}<p className="mt-1 line-clamp-1 text-xs font-normal text-black/45">{task.description}</p></td>
                    <td className="px-4 py-4"><span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${statusClasses(task.status)}`}>{statusLabel(task.status)}</span></td>
                    <td className="px-4 py-4"><Badge tone={priorityTone(task.priority)}>{task.priority}</Badge></td>
                    <td className="px-4 py-4"><span className="inline-flex items-center gap-2"><Avatar name={task.assignedToName} photoUrl={task.assignedToPhoto} className="size-7" /> {task.assignedToName}</span></td>
                    <td className="px-4 py-4">{formatCategoryLabel(task.category)}</td>
                    <td className="px-4 py-4">{formatShortDateTime(task.dueDate)}</td>
                    <td className="px-4 py-4">{task.locationName}</td>
                    <td className="px-4 py-4">{formatShortDateTime(task.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {view === "BOARD" ? (
        <Card className="overflow-hidden bg-white p-0">
          <div className="flex flex-col gap-3 border-b border-black/5 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Kanban className="size-5 text-[#C66170]" />
              <div>
                <h2 className="text-xl font-semibold">Board operativa</h2>
                <p className="text-sm text-black/45">Sposta mentalmente il lavoro per stato e apri sempre lo stesso dettaglio.</p>
              </div>
            </div>
            <div className="flex flex-1 items-center gap-2 rounded-2xl border border-black/10 px-3 py-2 lg:max-w-sm">
              <Search className="size-4 text-black/35" />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cerca task..." className="w-full bg-transparent text-sm outline-none" />
            </div>
          </div>
          <div className="grid gap-4 p-4 xl:grid-cols-4">
            {boardColumns.map((column) => (
              <div key={column.label} className={`min-h-[420px] rounded-[26px] ${column.color} p-4`}>
                <div className="mb-4 flex items-center justify-between">
                  <button type="button" onClick={() => { setFilter(column.filter); setView("LIST"); }} className={`text-lg font-bold ${column.text}`}>
                    {column.label}
                  </button>
                  <span className={`rounded-full bg-white px-3 py-1 text-xs font-bold ${column.text}`}>{column.tasks.length}</span>
                </div>
                <div className="grid gap-3">
                  {column.tasks.length === 0 ? <p className="rounded-2xl bg-white/70 p-4 text-sm text-black/40">Nessuna task.</p> : null}
                  {column.tasks.map((task) => (
                    <button key={task.id} onClick={() => setSelected(task)} className="rounded-2xl border border-black/5 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold leading-5">{task.title}</h3>
                        <span className="text-lg leading-none text-black/35">...</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
                        <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-black/50">{formatCategoryLabel(task.category)}</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-black/45">
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <Avatar name={task.assignedToName} photoUrl={task.assignedToPhoto} className="size-6" />
                          <span className="truncate">{task.assignedToName}</span>
                        </span>
                        <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" /> {formatTaskDate(task.dueDate)}</span>
                      </div>
                    </button>
                  ))}
                </div>
                {canAssign || role === "DIPENDENTE" ? (
                  <button type="button" onClick={() => setOpen(true)} className={`mt-4 inline-flex items-center gap-2 text-sm font-bold ${column.text}`}>
                    <Plus className="size-4" /> Nuova task
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {view === "CALENDAR" ? (
        <Card className="bg-white p-0">
          <div className="flex flex-col gap-3 border-b border-black/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button variant="soft">Oggi</Button>
              <h2 className="px-3 text-xl font-semibold">{calendarTitle}</h2>
            </div>
            <div className="rounded-2xl bg-[#FAF7F9] p-1">
              <button onClick={() => setCalendarMode("MONTH")} className={`rounded-xl px-4 py-2 text-sm font-bold ${calendarMode === "MONTH" ? "bg-white shadow-sm" : "text-black/45"}`}>Mese</button>
              <button onClick={() => setCalendarMode("WEEK")} className={`rounded-xl px-4 py-2 text-sm font-bold ${calendarMode === "WEEK" ? "bg-white shadow-sm" : "text-black/45"}`}>Settimana</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className={calendarMode === "WEEK" ? "min-w-[980px]" : "min-w-[860px]"}>
              <div className="grid grid-cols-7 border-b border-black/5 text-center text-xs font-bold uppercase tracking-[0.12em] text-black/35">
                {["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"].map((day) => <div key={day} className="p-3">{day}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {calendarCells.map((date) => {
                  const dayTasks = filteredTasks.filter((task) => localDateKey(taskCalendarDate(task)) === localDateKey(date));
                  const visibleDayTasks = dayTasks.slice(0, calendarMode === "WEEK" ? 8 : 3);
                  const hiddenCount = dayTasks.length - visibleDayTasks.length;
                  const muted = date.getMonth() !== monthStart.getMonth();
                  return (
                    <div
                      key={date.toISOString()}
                      className={cn(
                        "border-b border-r border-black/5",
                        calendarMode === "WEEK" ? "min-h-[22rem] p-3" : "min-h-32 p-2",
                        calendarMode === "MONTH" && muted ? "bg-black/[0.015] text-black/30" : "",
                      )}
                    >
                      <p className="text-sm font-semibold">{calendarMode === "WEEK" ? new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric" }).format(date) : date.getDate()}</p>
                      <div className="mt-2 grid gap-1.5">
                        {visibleDayTasks.map((task) => (
                          <button
                            key={task.id}
                            onClick={() => setSelected(task)}
                            className={cn(
                              "min-w-0 rounded-xl border text-left text-xs font-semibold leading-snug transition hover:-translate-y-0.5",
                              calendarMode === "WEEK" ? "px-3 py-2" : "px-2 py-1",
                              calendarClasses(task),
                            )}
                          >
                            <span className="block whitespace-normal break-words">{task.title}</span>
                            <span className="mt-0.5 block text-[10px] font-medium opacity-70">{task.dueDate ? formatShortDateTime(task.dueDate) : `Creata ${formatTaskDate(task.createdAt)}`}</span>
                          </button>
                        ))}
                        {hiddenCount > 0 ? <p className="rounded-lg bg-black/[0.04] px-2 py-1 text-[10px] font-bold text-black/45">+ {hiddenCount} altre task</p> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {view === "LIST" ? (
        <>
          <Card className="bg-white">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold">Liste operative</h2>
              <Badge tone="pink">{openTasks.length}</Badge>
            </div>
            <div className="grid gap-2">
              {listSections.map((section) => (
                <button key={section.filter} onClick={() => setFilter(section.filter)} className={`flex items-center justify-between border-b border-black/5 py-4 text-left last:border-0 ${filter === section.filter ? "font-bold" : ""}`}>
                  <span className="inline-flex items-center gap-3"><ListChecks className={`size-5 ${section.color}`} /> {section.label}</span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#FAF7F9] px-3 py-1 text-sm font-bold">{section.tasks.length}<ChevronRight className="size-4" /></span>
                </button>
              ))}
            </div>
          </Card>
          <Card className="bg-white">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">{listSections.find((item) => item.filter === filter)?.label}</p>
                <h2 className="mt-1 text-xl font-semibold">Task</h2>
              </div>
              <Badge tone="dark">{visibleTasks.length}</Badge>
            </div>
            <div className="grid gap-3">
              {visibleTasks.length === 0 ? <p className="rounded-2xl bg-[#FAF7F9] p-4 text-sm text-black/45">Nessuna task in questa sezione.</p> : null}
              {visibleTasks.map((task) => <TaskRow key={task.id} task={task} />)}
            </div>
          </Card>
        </>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 backdrop-blur-sm md:block md:overflow-y-auto md:bg-[#F8F3F6] md:p-4">
          <div className="max-h-[92dvh] w-full space-y-5 overflow-y-auto rounded-t-[36px] bg-[#F8F3F6] p-4 pb-24 shadow-2xl md:mx-auto md:max-h-none md:max-w-3xl md:overflow-visible md:rounded-none md:bg-transparent md:p-0 md:pb-24 md:shadow-none">
            <div className="mx-auto mb-2 h-1.5 w-14 rounded-full bg-black/15 md:hidden" />
            <div className="flex items-center justify-between pt-2 md:pt-4">
              <button onClick={() => setSelected(null)} className="grid size-12 place-items-center rounded-2xl bg-white shadow-sm"><ArrowLeft className="size-5" /></button>
              {canAssign || selected.createdById === userId ? (
                <button onClick={() => openEditTask(selected)} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold shadow-sm">
                  <Pencil className="size-4" /> Modifica task
                </button>
              ) : null}
            </div>
            <Card className="bg-white">
              <Badge tone={selected.status === "COMPLETED" ? "green" : "gold"}>{statusLabel(selected.status)}</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight">{selected.title}</h1>
              <p className="mt-4 text-lg leading-8 text-black/55">{selected.description}</p>
              <div className="mt-6 divide-y divide-black/5">
              {[
                  { icon: UserRound, label: "Assegnata da", value: selected.createdByName, photo: selected.createdByPhoto },
                  { icon: CalendarDays, label: "Data di creazione", value: formatFullDate(selected.createdAt) },
                  { icon: CalendarDays, label: "Scadenza", value: formatFullDate(selected.dueDate) },
                  { icon: Flag, label: "Priorita", value: selected.priority },
                  { icon: Tag, label: "Categoria", value: formatCategoryLabel(selected.category) },
                  { icon: CalendarDays, label: "Salone", value: selected.locationName },
                ].map((row) => {
                  const Icon = row.icon;
                  return (
                    <div key={row.label} className="flex items-center gap-4 py-4">
                      {"photo" in row ? <Avatar name={row.value} photoUrl={row.photo ?? null} className="size-9" /> : <Icon className="size-5 text-black/55" />}
                      <div className="flex-1">
                        <p className="text-sm text-black/45">{row.label}</p>
                        <p className="font-semibold">{row.value}</p>
                      </div>
                      <ChevronRight className="size-5 text-black/25" />
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card className="bg-white">
              <h2 className="font-semibold">Descrizione</h2>
              <p className="mt-4 leading-7 text-black/55">{selected.description}</p>
              {selected.photoUrl || selected.attachmentUrl || selected.attachmentName ? (
                <div className="mt-5">
                  <AttachmentCard name={selected.attachmentName ?? "Allegato task"} url={selected.photoUrl ?? selected.attachmentUrl} />
                </div>
              ) : null}
              {selected.linkUrl ? <a className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#8064D8]" href={selected.linkUrl} target="_blank"><LinkIcon className="size-4" /> Apri link</a> : null}
            </Card>
            {(selected.completionNote || selected.completionLinks.length > 0 || selected.completionFiles.length > 0) ? (
              <Card className="bg-white">
                <h2 className="font-semibold">Prova completamento</h2>
                {selected.completionNote ? <p className="mt-4 leading-7 text-black/55">{selected.completionNote}</p> : null}
                <div className="mt-4 grid gap-3">
                  {selected.completionFiles.map((file, index) => (
                    <AttachmentCard key={`${file.name}-${index}`} name={file.name} url={file.url} />
                  ))}
                  {selected.completionLinks.map((link) => <a key={link} href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-[#8064D8]"><LinkIcon className="size-4" /> {link}</a>)}
                </div>
              </Card>
            ) : null}
            <Card className="bg-white">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Checklist</h2>
                <span className="text-sm font-semibold text-[#8064D8]">{completedChecklist}/{selected.checklist.length} completate</span>
              </div>
              <div className="grid gap-3">
                {selected.checklist.length === 0 ? <p className="text-sm text-black/45">Nessuna checklist.</p> : null}
                {selected.checklist.map((item, index) => (
                  <label key={`${item.text}-${index}`} className="flex items-center gap-3">
                    <span className={`grid size-6 place-items-center rounded-md border ${item.done ? "bg-[#8064D8] text-white" : "border-black/20"}`}>{item.done ? <Check className="size-4" /> : null}</span>
                    <span className={item.done ? "text-black/45 line-through" : ""}>{item.text}</span>
                  </label>
                ))}
              </div>
            </Card>
            <Card className="bg-white">
              <h2 className="font-semibold">Commenti</h2>
              <div className="mt-4 grid gap-3">
                {selected.comments.length === 0 ? <p className="rounded-2xl bg-[#FAF7F9] p-4 text-sm text-black/45">Nessun commento ancora.</p> : null}
                {selected.comments.map((comment) => (
                  <div key={comment.id} className="rounded-2xl border border-black/5 p-4">
                    <div className="flex items-start gap-3">
                      <Avatar name={comment.userName} photoUrl={comment.userPhoto} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">{comment.userName}</p>
                            <p className="text-xs text-black/45">{formatTaskDate(comment.createdAt)}</p>
                          </div>
                          {comment.userId === userId ? (
                            <button type="button" onClick={() => { setEditingCommentId(comment.id); setCommentText(comment.message); }} className="text-xs font-semibold text-[#8064D8]">Modifica</button>
                          ) : null}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-black/60">{comment.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-black/10 p-3">
                <textarea className="min-h-20 w-full resize-none rounded-xl border border-black/10 px-3 py-2 text-sm outline-none" value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Scrivi un commento per questa task..." />
                <div className="mt-2 flex justify-end">
                  <Button onClick={saveComment}><Send className="size-4" /> {editingCommentId ? "Salva commento" : "Invia commento"}</Button>
                </div>
              </div>
            </Card>
            <Card className="bg-white">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Attivita e cronologia</h2>
                <Badge tone="dark">{selected.comments.length + 3}</Badge>
              </div>
              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between rounded-2xl bg-[#FAF7F9] p-4">
                  <span>Task creata</span>
                  <span className="font-semibold">{formatShortDateTime(selected.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-[#FAF7F9] p-4">
                  <span>Ultima modifica</span>
                  <span className="font-semibold">{formatShortDateTime(selected.updatedAt)}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-[#FAF7F9] p-4">
                  <span>Stato attuale</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClasses(selected.status)}`}>{statusLabel(selected.status)}</span>
                </div>
                {selected.comments.length > 0 ? (
                  <div className="flex items-center justify-between rounded-2xl bg-[#FAF7F9] p-4">
                    <span>Commenti registrati</span>
                    <span className="font-semibold">{selected.comments.length}</span>
                  </div>
                ) : null}
              </div>
            </Card>
            {selected.status === "ACTIVE" ? (
              <button type="button" onClick={() => timerRunning && setTimerPaused((value) => !value)} className="w-full rounded-[24px] bg-white p-5 text-center shadow-sm">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-black/45"><Timer className="size-4" /> Timer task {!timerRunning ? "non avviato" : timerPaused ? "in pausa" : "attivo"}</span>
                <span className="mt-2 block text-4xl font-semibold tabular-nums">{formatTimer(selected.timerSeconds)}</span>
                <span className="mt-1 block text-xs text-black/40">{timerRunning ? "Clicca sul timer per mettere in pausa o riprendere." : "Premi Avvia timer per iniziare a contare."}</span>
              </button>
            ) : selected.timerSeconds > 0 ? (
              <Card className="bg-white"><p className="text-sm text-black/45">Tempo impiegato</p><p className="mt-2 text-3xl font-semibold tabular-nums">{formatTimer(selected.timerSeconds)}</p></Card>
            ) : null}
            {isCompletedTask(selected) ? null : (
            <div className="sticky bottom-4 grid grid-cols-2 gap-3 rounded-[24px] bg-white p-3 shadow-lg">
              {isNewTask(selected) ? (
                <Button className="col-span-2" onClick={() => { setTimerRunning(true); setTimerPaused(false); void updateStatus(selected, "ACTIVE"); }}><Clock3 className="size-4" /> Inizia task</Button>
              ) : (
                <>
                  <Button variant="soft" onClick={() => { if (!timerRunning) { setTimerRunning(true); setTimerPaused(false); } else { setTimerPaused((value) => !value); } }}>{!timerRunning ? "Avvia timer" : timerPaused ? "Riprendi timer" : "Pausa timer"}</Button>
                  <Button onClick={() => setCompletionOpen(true)}><CheckCircle2 className="size-4" /> Completa task</Button>
                </>
              )}
            </div>
            )}
          </div>
        </div>
      ) : null}

      {attachmentPreview ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/35">Allegato</p>
                <h2 className="truncate text-lg font-semibold">{attachmentPreview.name}</h2>
              </div>
              <button onClick={() => setAttachmentPreview(null)} className="grid size-10 place-items-center rounded-xl border border-black/10"><X className="size-5" /></button>
            </div>
            <div className="max-h-[75dvh] overflow-auto bg-[#FAF7F9] p-4">
              {attachmentPreview.kind === "image" ? (
                <img src={attachmentPreview.url} alt={attachmentPreview.name} className="mx-auto max-h-[70dvh] w-full object-contain" />
              ) : (
                <div className="grid min-h-64 place-items-center rounded-2xl bg-white text-center">
                  <div>
                    <Paperclip className="mx-auto size-10 text-black/45" />
                    <p className="mt-3 font-semibold">{attachmentPreview.name}</p>
                    <p className="mt-1 text-sm text-black/45">Anteprima non disponibile per questo tipo di file.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {completionOpen && selected ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">Completamento</p>
                <h2 className="mt-2 text-2xl font-semibold">Invia prova task</h2>
                <p className="mt-1 text-sm text-black/50">Tempo registrato: {formatTimer(selected.timerSeconds)}</p>
              </div>
              <button onClick={() => setCompletionOpen(false)} className="grid size-10 place-items-center rounded-xl border border-black/10"><X className="size-5" /></button>
            </div>
            <div className="mt-5 grid gap-4">
              <textarea className="min-h-24 rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none" value={completion.note} onChange={(event) => setCompletion({ ...completion, note: event.target.value })} placeholder="Note finali o cosa e stato fatto..." />
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Field value={completion.link} onChange={(event) => setCompletion({ ...completion, link: event.target.value })} placeholder="https:// link prova" />
                <Button type="button" variant="soft">Link</Button>
              </div>
              <label className="grid cursor-pointer place-items-center rounded-2xl border border-dashed border-black/15 p-5 text-center text-sm font-semibold">
                <Paperclip className="mb-2 size-5" /> Carica multi file / foto
                <input type="file" multiple className="hidden" onChange={(event) => void attachCompletionFiles(event.target.files)} />
              </label>
              {completion.files.length > 0 ? (
                <div className="grid gap-3 rounded-2xl bg-[#FAF7F9] p-3 text-sm text-black/60">
                  {completion.files.map((file, index) => (
                    <div key={`${file.name}-${index}`}>
                      {file.url ? <img src={file.url} alt={file.name} className="max-h-64 w-full rounded-xl object-contain" /> : null}
                      <p className="mt-1">{file.name}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              <Button onClick={() => {
                const links = completion.link.trim() ? [completion.link.trim()] : [];
                setTimerRunning(false);
                setTimerPaused(false);
                void updateStatus(selected, "COMPLETED", { completionNote: completion.note, completionLinks: links, completionFiles: completion.files });
                setCompletionOpen(false);
              }}><Send className="size-4" /> Invia e completa</Button>
            </div>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm">
          <div className="ml-auto h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">{editingTaskId ? "Modifica task" : "Nuova task"}</p>
                <h2 className="mt-1 text-2xl font-semibold">{editingTaskId ? "Aggiorna task" : "Crea task"}</h2>
              </div>
              <button onClick={resetTaskForm} className="grid size-10 place-items-center rounded-xl border border-black/10"><X className="size-5" /></button>
            </div>
            <div className="grid gap-5">
              <label className="space-y-2"><span className="text-xs font-bold uppercase text-black/45">Titolo *</span><Field value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Controllare prenotazioni serali" /></label>
              <label className="space-y-2"><span className="text-xs font-bold uppercase text-black/45">Descrizione</span><textarea className="min-h-28 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm outline-none focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-2"><span className="text-sm font-semibold">Scadenza</span><Field type="datetime-local" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>
                <label className="space-y-2"><span className="text-sm font-semibold">Priorita</span><Select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="ALTA">Alta</option><option value="MEDIA">Media</option><option value="BASSA">Bassa</option></Select></label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold">Assegnato a</span>
                  <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-3 py-2">
                    {selectedWorker ? <Avatar name={selectedWorker.name} photoUrl={selectedWorker.photoUrl} className="size-10" /> : null}
                    <Select className="border-0 bg-transparent px-0 shadow-none focus:ring-0" value={form.assignedToId} onChange={(event) => setForm({ ...form, assignedToId: event.target.value })}>
                      {initialAllowedWorkers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
                    </Select>
                  </div>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold">Categoria</span>
                  <Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                    {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </Select>
                </label>
              </div>
              <div className="rounded-2xl border border-black/10 bg-[#FAF7F9] p-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/40">Categorie predefinite</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button key={category} type="button" onClick={() => setForm({ ...form, category })} className={`rounded-full px-3 py-1.5 text-xs font-bold ${form.category === category ? "bg-paradise-pink text-black" : "bg-white text-black/60 ring-1 ring-black/10"}`}>
                      {category}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-black/45">Le categorie si modificano da Impostazioni &gt; Task.</p>
              </div>
              <label className="space-y-2"><span className="text-sm font-semibold">Checklist</span><textarea className="min-h-28 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm outline-none" value={form.checklistText} onChange={(event) => setForm({ ...form, checklistText: event.target.value })} placeholder={"Controllare tavoli VIP\nVerificare richieste speciali"} /></label>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <label className="grid cursor-pointer place-items-center gap-2 rounded-2xl border border-black/10 p-4 text-sm font-semibold"><Paperclip className="size-5" />Allega file<input type="file" className="hidden" onChange={(event) => void attachMainFile(event.target.files?.[0])} /></label>
                <label className="grid cursor-pointer place-items-center gap-2 rounded-2xl border border-black/10 p-4 text-sm font-semibold"><FileImage className="size-5" />Foto<input type="file" accept="image/*" className="hidden" onChange={(event) => void attachPhoto(event.target.files?.[0])} /></label>
                <label className="col-span-2 space-y-2"><span className="sr-only">Link</span><Field value={form.linkUrl} onChange={(event) => setForm({ ...form, linkUrl: event.target.value })} placeholder="https:// link" /></label>
              </div>
              {form.photoUrl ? (
                <div className="overflow-hidden rounded-[24px] border border-black/10 bg-[#FAF7F9]">
                  <img src={form.photoUrl} alt={form.attachmentName || "Foto task"} className="max-h-80 w-full object-contain" />
                </div>
              ) : null}
              {formStatus ? (
                <div className={cn("rounded-2xl px-4 py-3 text-sm font-bold", formStatus.includes("inviata") || formStatus.includes("creata") ? "bg-emerald-100 text-emerald-800" : "bg-paradise-nude text-black/70")}>
                  {formStatus}
                </div>
              ) : null}
              <div className="flex justify-between gap-3 border-t border-black/5 pt-5">
                <Button variant="soft" onClick={resetTaskForm}>Annulla</Button>
                <Button onClick={editingTaskId ? saveTaskEdit : createTask} disabled={saving}>
                  <Send className="size-4" /> {saving ? "Salvo..." : editingTaskId ? "Salva modifiche" : "Crea task"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
