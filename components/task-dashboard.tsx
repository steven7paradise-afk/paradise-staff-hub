"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  X,
} from "lucide-react";
import { Badge, Button, Card, Field, Select } from "@/components/ui";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { GlobalFullscreenLayer } from "@/components/global-fullscreen-layer";

type Worker = { id: string; name: string; locationId: string | null; photoUrl: string | null; mansione?: string | null; role?: Role | string };
type ChecklistItem = { text: string; done: boolean; completedBy?: string | null; completedAt?: string | null };
type CompletionFile = { name: string; url?: string | null };
type FreeNoteBlock =
  | { type: "title"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "text"; text: string }
  | { type: "image"; name: string; url: string }
  | { type: "file"; name: string; url?: string | null }
  | { type: "link"; url: string };
type Task = {
  id: string;
  detailsLoaded: boolean;
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
  assignees: { id: string; name: string; photoUrl: string | null }[];
  createdByName: string;
  createdById: string;
  createdByPhoto: string | null;
  dueDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
type TaskComment = { 
  id: string; 
  message: string; 
  userId: string; 
  userName: string; 
  userPhoto: string | null; 
  createdAt: string; 
  updatedAt: string;
  files?: { name: string; url?: string; previewUrl?: string; driveFileId?: string; driveFileUrl?: string }[] | null;
};
type TaskView = "HOME" | "TABLE" | "BOARD" | "CALENDAR" | "LIST";
type TaskFilter = "TODAY" | "ACTIVE" | "NEW" | "WAITING" | "COMPLETED";
type AttachmentPreview = { name: string; url: string; kind: "image" | "file" };
type TodayAttendanceLog = { type: "ENTRATA" | "PAUSA" | "RIENTRO" | "USCITA"; timestamp: string; time: string };

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

function renderTextWithLinks(text: string) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (part.match(/^https?:\/\//i)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#8064D8] hover:underline break-all font-semibold"
        >
          {part}
        </a>
      );
    }
    return part;
  });
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
  if (["COMPLETED", "DONE"].includes(normalizedStatus(status))) return "Completato";
  if (normalizedStatus(status) === "ACTIVE") return "In corso";
  if (isWaitingTask({ status } as Task)) return "Fermo";
  return "Da fare";
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
      {photoUrl ? <img src={resolveDrivePhotoUrl(photoUrl)} alt={name} className="size-full object-cover" /> : name.slice(0, 2).toUpperCase()}
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
  if (normalizedStatus(status) === "ACTIVE") return "bg-yellow-100 text-yellow-800";
  if (isWaitingTask({ status } as Task)) return "bg-violet-100 text-violet-800";
  return "bg-red-100 text-red-800";
}

function calendarClasses(task: Task) {
  if (isCompletedTask(task)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (isActiveTask(task)) return "border-yellow-200 bg-yellow-50 text-yellow-800";
  if (isWaitingTask(task)) return "border-violet-200 bg-violet-50 text-violet-800";
  return "border-red-200 bg-red-50 text-red-700";
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

function taskFilePreviewUrl(file: { url?: string | null; previewUrl?: string | null; driveFileId?: string | null }) {
  if (file.previewUrl) return file.previewUrl;
  if (file.url) return file.url;
  if (file.driveFileId) return `/api/drive-image?id=${encodeURIComponent(file.driveFileId)}`;
  return "";
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

function formatTimerWithDays(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const days = Math.floor(safe / 86400);
  const rest = safe % 86400;
  const time = formatTimer(rest);
  return days > 0 ? `${days}g ${time}` : time;
}

function totalTaskDays(task: Task) {
  const start = new Date(task.startedAt ?? task.createdAt);
  const end = task.completedAt ? new Date(task.completedAt) : new Date();
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return 1;
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
}

function activeWorkSecondsSince(startedAt: string, logs: TodayAttendanceLog[]) {
  const started = new Date(startedAt).getTime();
  const ordered = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  let activeFrom: number | null = null;
  let total = 0;

  ordered.forEach((log) => {
    const time = new Date(log.timestamp).getTime();
    if (log.type === "ENTRATA" || log.type === "RIENTRO") {
      activeFrom = Math.max(time, started);
    }
    if ((log.type === "PAUSA" || log.type === "USCITA") && activeFrom !== null) {
      total += Math.max(0, time - activeFrom);
      activeFrom = null;
    }
  });

  if (activeFrom !== null) total += Math.max(0, Date.now() - activeFrom);
  return Math.floor(total / 1000);
}

function attendanceTimerState(logs: TodayAttendanceLog[]) {
  const latest = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).at(-1);
  if (!latest) return { isWorking: false, label: "Timer fermo: nessuna entrata timbrata oggi.", tone: "muted" as const };
  if (latest.type === "PAUSA") return { isWorking: false, label: `Timer fermo: pausa dalle ${latest.time}.`, tone: "pause" as const };
  if (latest.type === "USCITA") return { isWorking: false, label: `Timer fermo: uscita alle ${latest.time}.`, tone: "muted" as const };
  return { isWorking: true, label: `Timer attivo dalle timbrature: ultima ${latest.type.toLowerCase()} alle ${latest.time}.`, tone: "work" as const };
}

function getTaskCurrentSeconds(task: Task, attendanceLogs: TodayAttendanceLog[] = []) {
  if (task.status === "ACTIVE" && task.startedAt) {
    return Math.max(0, task.timerSeconds + activeWorkSecondsSince(task.startedAt, attendanceLogs));
  }
  return task.timerSeconds;
}

function parseFreeNotes(value?: string | null): FreeNoteBlock[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.flatMap((block): FreeNoteBlock[] => {
        if (!block || typeof block !== "object") return [];
        const item = block as Record<string, unknown>;
        if (item.type === "title" && typeof item.text === "string") return [{ type: "title", text: item.text }];
        if ((item.type === "paragraph" || item.type === "text") && typeof item.text === "string") return [{ type: "paragraph", text: item.text }];
        if (item.type === "image" && typeof item.name === "string" && typeof item.url === "string") return [{ type: "image", name: item.name, url: item.url }];
        if (item.type === "file" && typeof item.name === "string") return [{ type: "file", name: item.name, url: item.url ? String(item.url) : null }];
        if (item.type === "link" && typeof item.url === "string") return [{ type: "link", url: item.url }];
        return [];
      });
    }
  } catch {
    return [{ type: "paragraph", text: value }];
  }
  return [];
}

function serializeFreeNotes(blocks: FreeNoteBlock[]) {
  return JSON.stringify(blocks);
}

function normalizeFreeNoteLink(value: string) {
  const clean = value.replace(/[),.;!?]+$/g, "");
  return clean.startsWith("http://") || clean.startsWith("https://") ? clean : `https://${clean}`;
}

function extractFreeNoteLinks(value: string) {
  const matches = value.match(/https?:\/\/[^\s]+|www\.[^\s]+/gi) ?? [];
  return Array.from(new Set(matches.map(normalizeFreeNoteLink)));
}

function formatFreeNoteLinkLabel(value: string) {
  try {
    const url = new URL(value);
    const path = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const shortPath = path.length > 42 ? `${path.slice(0, 42)}...` : path;
    return shortPath ? `${url.hostname} · ${shortPath}` : url.hostname;
  } catch {
    return value.length > 56 ? `${value.slice(0, 56)}...` : value;
  }
}

function workerMentionSlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");
}

function workerMentionRoleLabel(worker: Worker) {
  if (worker.role === "SUPER_ADMIN") return "Super Admin";
  if (worker.role === "ADMIN") return "Admin";
  return "Responsabile";
}

function getActiveMentionQuery(value: string) {
  return value.match(/(^|\s)@([a-zA-Z0-9_]*)$/)?.[2] ?? null;
}

function extractMentionedWorkers(value: string, workers: Worker[]) {
  const tags = Array.from(value.matchAll(/@([a-zA-Z0-9_]+)/g)).map((match) => match[1].toLowerCase());
  if (tags.length === 0) return [];
  return workers.filter((worker) => tags.includes(workerMentionSlug(worker.name).toLowerCase()));
}

export function TaskDashboard({ role, userId, userName, currentUserLocationId, workers, mentionableUsers, categories: initialCategories, initialTasks, canManageTasks = false, initialTaskId = null }: { role: Role; userId: string; userName: string; currentUserLocationId: string | null; workers: Worker[]; mentionableUsers: Worker[]; categories: string[]; initialTasks: Task[]; canManageTasks?: boolean; initialTaskId?: string | null }) {
  const canAssign = canManageTasks || role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN" || role === "RESPONSABILE";
  const canAssignAcrossTeam = canManageTasks || role === "ZERO" || role === "SUPER_ADMIN" || role === "ADMIN";
  const initialAllowedWorkers = canAssignAcrossTeam ? workers : mentionableUsers;

  const [tasks, setTasks] = useState(initialTasks);
  const [view, setView] = useState<TaskView>("HOME");
  const [open, setOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Task | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedExtrasLoading, setSelectedExtrasLoading] = useState(false);
  const [selectedLoadError, setSelectedLoadError] = useState("");
  const detailRequestRef = useRef(0);
  const initialTaskOpenedRef = useRef(false);
  const taskDetailPageRef = useRef<HTMLDivElement | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("ACTIVE");
  const [assignmentFilter, setAssignmentFilter] = useState<"ALL" | "ASSIGNED_TO_ME" | "ASSIGNED_BY_ME">("ASSIGNED_TO_ME");
  const [attachmentPreview, setAttachmentPreview] = useState<AttachmentPreview | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<"updated" | "due" | "priority" | "title">("updated");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [calendarMode, setCalendarMode] = useState<"MONTH" | "WEEK">("MONTH");
  const [saving, setSaving] = useState(false);
  const [formStatus, setFormStatus] = useState("");
  const [completionTarget, setCompletionTarget] = useState<Task | null>(null);
  const [completionSaving, setCompletionSaving] = useState(false);
  const [completionError, setCompletionError] = useState("");
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentFiles, setCommentFiles] = useState<NonNullable<TaskComment["files"]>>([]);
  const [commentUploading, setCommentUploading] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);
  const [todayAttendanceLogs, setTodayAttendanceLogs] = useState<TodayAttendanceLog[]>([]);
  const [completion, setCompletion] = useState({ note: "", link: "", files: [] as CompletionFile[] });
  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedToId: initialAllowedWorkers[0]?.id ?? "",
    assignedToIds: initialAllowedWorkers[0]?.id ? [initialAllowedWorkers[0].id] : [] as string[],
    priority: "MEDIA",
    category: "Operativa",
    dueDate: "",
    linkUrl: "",
    attachmentName: "",
    photoUrl: "",
    checklistItems: [""],
  });

  useEffect(() => {
    if (!selected?.id) return;
    taskDetailPageRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [selected?.id]);

  useEffect(() => {
    if (!initialTaskId || initialTaskOpenedRef.current) return;
    const linkedTask = initialTasks.find((task) => task.id === initialTaskId);
    if (!linkedTask) return;
    initialTaskOpenedRef.current = true;
    void openTask(linkedTask);
  }, [initialTaskId, initialTasks]);

  const baseTasks = useMemo(() => {
    return canAssign 
      ? tasks 
      : tasks.filter((task) => 
          task.assignedToId === userId || 
          task.assignees?.some((a) => a.id === userId) ||
          task.createdById === userId
        );
  }, [tasks, canAssign, userId]);

  const personalTasks = useMemo(() => {
    if (assignmentFilter === "ASSIGNED_TO_ME") {
      return baseTasks.filter((task) => task.assignedToId === userId || task.assignees?.some((a) => a.id === userId));
    }
    if (assignmentFilter === "ASSIGNED_BY_ME") {
      return baseTasks.filter((task) => task.createdById === userId);
    }
    return baseTasks;
  }, [baseTasks, assignmentFilter, userId]);

  const assignedToMeCount = baseTasks.filter((task) => task.assignedToId === userId || task.assignees?.some((a) => a.id === userId)).length;
  const assignedByMeCount = baseTasks.filter((task) => task.createdById === userId).length;

  const activeTasks = personalTasks.filter(isActiveTask);
  const completedTasks = personalTasks.filter(isCompletedTask);
  const newTasks = personalTasks.filter(isNewTask);
  const waitingTasks = personalTasks.filter(isWaitingTask);
  const openTasks = personalTasks.filter((task) => !isCompletedTask(task));
  const todayTasks = openTasks.filter(isTodayTask);
  const visibleTasks = filter === "TODAY" ? todayTasks : filter === "COMPLETED" ? completedTasks : filter === "WAITING" ? waitingTasks : filter === "NEW" ? newTasks : activeTasks;
  const featuredTask = todayTasks[0] ?? activeTasks[0] ?? newTasks[0] ?? null;
  const timerAttendance = attendanceTimerState(todayAttendanceLogs);
  const activeMentionQuery = getActiveMentionQuery(commentText);
  const mentionSuggestions = activeMentionQuery === null
    ? mentionableUsers
    : mentionableUsers
        .filter((worker) => worker.name.toLowerCase().includes(activeMentionQuery.toLowerCase()) || workerMentionSlug(worker.name).toLowerCase().includes(activeMentionQuery.toLowerCase()))
        .slice(0, 8);
  const mentionedWorkers = extractMentionedWorkers(commentText, mentionableUsers);
  const completedChecklist = selected?.checklist.filter((item) => item.done).length ?? 0;

  useEffect(() => {
    let alive = true;
    async function loadTodayAttendance() {
      const response = await fetch("/api/attendance/my-today", { cache: "no-store" }).catch(() => null);
      if (!response?.ok) return;
      const data = await response.json().catch(() => []);
      if (alive && Array.isArray(data)) setTodayAttendanceLogs(data);
    }
    void loadTodayAttendance();
    const interval = window.setInterval(loadTodayAttendance, 60_000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);
  const timelineEvents = useMemo(() => {
    if (!selected) return [];
    const events: {
      type: "system" | "comment";
      date: Date;
      title: string;
      description?: string;
      user?: { name: string; photoUrl: string | null };
      commentId?: string;
      commentUser?: string;
      commentPhoto?: string | null;
      commentUserId?: string;
      message?: string;
      files?: any[];
    }[] = [];

    // 1. Task created
    events.push({
      type: "system",
      date: new Date(selected.createdAt),
      title: "Task creata",
      description: `Creata da ${selected.createdByName}`,
      user: { name: selected.createdByName, photoUrl: selected.createdByPhoto }
    });

    // 2. Task started
    if (selected.startedAt) {
      events.push({
        type: "system",
        date: new Date(selected.startedAt),
        title: "Task iniziata (Timer avviato)",
        description: "La task è passata in corso."
      });
    }

    // 3. User comments (our "blocks")
    if (selected.comments) {
      selected.comments.forEach((c) => {
        events.push({
          type: "comment",
          date: new Date(c.createdAt),
          title: "",
          commentId: c.id,
          commentUser: c.userName || "Collaboratore",
          commentPhoto: c.userPhoto || null,
          commentUserId: c.userId,
          message: c.message,
          files: typeof c.files === "string" ? JSON.parse(c.files) : (c.files || [])
        });
      });
    }

    // 4. Task completed
    if (selected.completedAt) {
      events.push({
        type: "system",
        date: new Date(selected.completedAt),
        title: "Task completata",
        description: selected.completionNote || "Completata con successo.",
        files: selected.completionFiles || [],
        user: { name: selected.assignedToName, photoUrl: selected.assignedToPhoto }
      });
    }

    // Sort all events by date asc
    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [selected]);
  const categories = Array.from(new Set([...initialCategories, ...tasks.map((task) => task.category).filter(Boolean)]));
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
      { filter: "TODAY" as TaskFilter, label: "Tasks di oggi", shortLabel: "Oggi", value: todayTasks.length, icon: CalendarDays, color: "text-[#C66170]" },
      { filter: "NEW" as TaskFilter, label: "Da fare", shortLabel: "Da fare", value: newTasks.length, icon: Clock3, color: "text-red-600" },
      { filter: "ACTIVE" as TaskFilter, label: "In corso", shortLabel: "In corso", value: activeTasks.length, icon: ListChecks, color: "text-yellow-600" },
      { filter: "COMPLETED" as TaskFilter, label: "Completato", shortLabel: "Fatte", value: completedTasks.length, icon: CheckCircle2, color: "text-emerald-600" },
      { filter: "WAITING" as TaskFilter, label: "Fermo", shortLabel: "Fermo", value: waitingTasks.length, icon: Timer, color: "text-violet-600" },
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
        assignedToId: form.assignedToIds[0] ?? "",
        assignedToIds: form.assignedToIds,
        checklist: form.checklistItems.map((item) => item.trim()).filter(Boolean),
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
        detailsLoaded: true,
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
          files: comment.files,
        })) : [],
        locationId: data.location_id,
        locationName: data.location?.name ?? "Salone",
        assignedToId: data.assignees?.[0]?.id ?? data.assigned_to_id ?? "",
        assignedToName: data.assignees?.map((a: any) => a.name).join(", ") || data.assigned_to?.name || "Nessuno",
        assignedToPhoto: data.assignees?.[0]?.photo_url ?? data.assigned_to?.photo_url ?? null,
        assignees: Array.isArray(data.assignees) 
          ? data.assignees.map((a: any) => ({ id: a.id, name: a.name, photoUrl: a.photo_url }))
          : data.assigned_to 
            ? [{ id: data.assigned_to.id, name: data.assigned_to.name, photoUrl: data.assigned_to.photo_url }]
            : [],
        createdByName: data.created_by.name,
        createdById: data.created_by_id,
        createdByPhoto: data.created_by.photo_url ?? null,
        dueDate: data.due_date,
        startedAt: data.started_at ?? null,
        completedAt: data.completed_at ?? null,
        createdAt: data.created_at,
        updatedAt: data.updated_at ?? data.created_at,
      },
      ...current,
    ]);
    setFormStatus(`Task inviata a ${data.assignees?.map((a: any) => a.name).join(", ") || data.assigned_to?.name || "Nessuno"}. Notifica creata.`);
    setTimeout(() => {
      setForm({ title: "", description: "", assignedToId: initialAllowedWorkers[0]?.id ?? "", assignedToIds: initialAllowedWorkers[0]?.id ? [initialAllowedWorkers[0].id] : [] as string[], priority: "MEDIA", category: "Operativa", dueDate: "", linkUrl: "", attachmentName: "", photoUrl: "", checklistItems: [""] });
      setFormStatus("");
      setOpen(false);
    }, 900);
  }

  function resetTaskForm() {
    setForm({ title: "", description: "", assignedToId: initialAllowedWorkers[0]?.id ?? "", assignedToIds: initialAllowedWorkers[0]?.id ? [initialAllowedWorkers[0].id] : [] as string[], priority: "MEDIA", category: "Operativa", dueDate: "", linkUrl: "", attachmentName: "", photoUrl: "", checklistItems: [""] });
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
      assignedToIds: task.assignees ? task.assignees.map((a) => a.id) : [task.assignedToId],
      priority: task.priority,
      category: task.category,
      dueDate: toDateTimeLocal(task.dueDate),
      linkUrl: task.linkUrl ?? "",
      attachmentName: task.attachmentName ?? "",
      photoUrl: task.photoUrl ?? "",
      checklistItems: task.checklist.length > 0 ? task.checklist.map((item) => item.text) : [""],
    });
    setOpen(true);
  }

  async function saveTaskEdit() {
    if (!editingTaskId) return;
    setSaving(true);
    const response = await fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingTaskId, ...form, assignedToId: form.assignedToIds[0] ?? "", assignedToIds: form.assignedToIds, checklist: form.checklistItems.map((item) => item.trim()).filter(Boolean) }),
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

  async function attachDescriptionImage(file: File | undefined) {
    if (!selected || !file) return;
    const dataUrl = await fileToDataUrl(file);
    const response = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, attachmentName: file.name, photoUrl: dataUrl }),
    });
    if (!response.ok) return;
    const mapped = mapApiTask(await response.json());
    setSelected(mapped);
    setTasks((current) => current.map((task) => task.id === mapped.id ? mapped : task));
  }

  async function toggleChecklistItem(index: number) {
    if (!selected) return;
    const nextChecklist = selected.checklist.map((item, idx) =>
      idx === index
        ? {
            ...item,
            done: !item.done,
            completedBy: !item.done ? userName : null,
            completedAt: !item.done ? new Date().toISOString() : null,
          }
        : item
    );
    const nextTask = { ...selected, checklist: nextChecklist };
    setSelected(nextTask);
    setTasks((current) => current.map((task) => task.id === selected.id ? nextTask : task));

    const response = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, checklist: nextChecklist }),
    });
    if (!response.ok) {
      setSelected(selected);
      setTasks((current) => current.map((task) => task.id === selected.id ? selected : task));
    }
  }

  const [ticker, setTicker] = useState(0);
  useEffect(() => {
    const hasActiveTask = tasks.some(t => t.status === "ACTIVE");
    if (!hasActiveTask || !timerAttendance.isWorking) return;
    const interval = window.setInterval(() => {
      setTicker((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [tasks, timerAttendance.isWorking]);

  async function updateStatus(task: Task, status: "ACTIVE" | "COMPLETED" | "WAITING", extra?: { completionNote?: string; completionLinks?: string[]; completionFiles?: CompletionFile[] }) {
    const currentSeconds = getTaskCurrentSeconds(task, todayAttendanceLogs);
    const nextTask = { 
      ...task, 
      status, 
      timerSeconds: currentSeconds,
      startedAt: status === "ACTIVE" ? new Date().toISOString() : (status === "WAITING" ? null : task.startedAt)
    };
    setTasks((current) => current.map((item) => (item.id === task.id ? nextTask : item)));
    if (selected?.id === task.id) setSelected(nextTask);
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          status,
          timerSeconds: currentSeconds,
          startedAt: status === "ACTIVE" ? new Date().toISOString() : (status === "WAITING" ? null : undefined),
          ...extra,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
        if (selected?.id === task.id) setSelected(task);
        return { ok: false, error: data?.error || "Non è stato possibile salvare la Task. Riprova." };
      }
      const mapped = mapApiTask(data);
      setTasks((current) => current.map((item) => (item.id === task.id ? mapped : item)));
      if (selected?.id === task.id) setSelected(mapped);
      return { ok: true, error: "" };
    } catch {
      setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
      if (selected?.id === task.id) setSelected(task);
      return { ok: false, error: "Connessione non disponibile. Controlla la rete e riprova." };
    }
  }

  function requestTaskCompletion(task: Task) {
    if (isCompletedTask(task)) {
      void openTask(task);
      return;
    }
    setCompletion({ note: "", link: "", files: [] });
    setCompletionError("");
    setCompletionTarget(task);
  }

  function mapApiTask(data: any): Task {
    return {
      id: data.id,
      detailsLoaded: true,
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
      assignedToId: data.assignees?.[0]?.id ?? data.assigned_to_id ?? "",
      assignedToName: data.assignees?.map((a: any) => a.name).join(", ") || data.assigned_to?.name || "Nessuno",
      assignedToPhoto: data.assignees?.[0]?.photo_url ?? data.assigned_to?.photo_url ?? null,
      assignees: Array.isArray(data.assignees) 
        ? data.assignees.map((a: any) => ({ id: a.id, name: a.name, photoUrl: a.photo_url }))
        : data.assigned_to 
          ? [{ id: data.assigned_to.id, name: data.assigned_to.name, photoUrl: data.assigned_to.photo_url }]
          : [],
      createdByName: data.created_by.name,
      createdById: data.created_by_id,
      createdByPhoto: data.created_by.photo_url ?? null,
      dueDate: data.due_date,
      startedAt: data.started_at ?? null,
      completedAt: data.completed_at ?? null,
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
        files: comment.files,
      })) : [],
    };
  }

  async function openTask(task: Task | null) {
    const requestId = ++detailRequestRef.current;
    setSelectedLoadError("");

    if (!task) {
      setSelectedLoading(false);
      setSelectedExtrasLoading(false);
      setSelected(null);
      return;
    }

    setSelected(task);
    if (task.detailsLoaded) {
      setSelectedLoading(false);
      return;
    }

    setSelectedLoading(true);
    try {
      const response = await fetch(`/api/tasks?id=${encodeURIComponent(task.id)}&section=core`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossibile caricare la task");
      if (detailRequestRef.current !== requestId) return;

      const coreTask = { ...mapApiTask(data), detailsLoaded: false };
      setTasks((current) => current.map((item) => item.id === coreTask.id ? coreTask : item));
      setSelected(coreTask);
      setSelectedLoading(false);
      setSelectedExtrasLoading(true);

      const extrasResponse = await fetch(`/api/tasks?id=${encodeURIComponent(task.id)}&section=extras`);
      const extras = await extrasResponse.json();
      if (!extrasResponse.ok) throw new Error(extras.error || "Impossibile caricare immagini e commenti");
      if (detailRequestRef.current !== requestId) return;

      const detailedTask: Task = {
        ...coreTask,
        detailsLoaded: true,
        attachmentName: extras.attachment_name ?? null,
        attachmentUrl: extras.attachment_url ?? null,
        photoUrl: extras.photo_url ?? null,
        notes: extras.notes ?? null,
        completionNote: extras.completion_note ?? null,
        completionFiles: normalizeCompletionFiles(extras.completion_files),
        completionLinks: Array.isArray(extras.completion_links) ? extras.completion_links : [],
        comments: Array.isArray(extras.comments) ? extras.comments.map((comment: any) => ({
          id: comment.id,
          message: comment.message,
          userId: comment.user_id,
          userName: comment.user.name,
          userPhoto: comment.user.photo_url ?? null,
          createdAt: comment.created_at,
          updatedAt: comment.updated_at,
          files: comment.files,
        })) : [],
      };
      setTasks((current) => current.map((item) => item.id === detailedTask.id ? detailedTask : item));
      setSelected(detailedTask);
    } catch (error) {
      if (detailRequestRef.current === requestId) {
        setSelectedLoadError(error instanceof Error ? error.message : "Impossibile caricare la task");
      }
    } finally {
      if (detailRequestRef.current === requestId) {
        setSelectedLoading(false);
        setSelectedExtrasLoading(false);
      }
    }
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


  async function attachCommentFiles(files: FileList | null) {
    if (!files) return;
    setCommentUploading(true);
    const next = [...commentFiles];
    for (const file of Array.from(files)) {
      const url = await fileToDataUrl(file);
      next.push({ name: file.name, url });
    }
    setCommentFiles(next);
    setCommentUploading(false);
  }

  function removeCommentFile(index: number) {
    setCommentFiles((current) => current.filter((_, i) => i !== index));
  }

  async function saveComment() {
    if (!selected) return;
    const trimmed = commentText.trim();
    if (commentSaving || (!trimmed && commentFiles.length === 0)) return;
    const isEdit = Boolean(editingCommentId);
    setCommentSaving(true);
    const response = await fetch("/api/tasks/comments", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isEdit 
          ? { id: editingCommentId, message: trimmed, files: commentFiles } 
          : { taskId: selected.id, message: trimmed, files: commentFiles }
      ),
    });
    if (!response.ok) {
      setCommentSaving(false);
      return;
    }
    const data = await response.json();
    const comment: TaskComment = {
      id: data.id,
      message: data.message,
      userId: data.user_id,
      userName: data.user.name,
      userPhoto: data.user.photo_url ?? null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      files: data.files ? (typeof data.files === "string" ? JSON.parse(data.files) : data.files) : []
    };
    const commentAlreadyExists = selected.comments.some((item) => item.id === comment.id);
    const comments = isEdit || commentAlreadyExists
      ? selected.comments.map((item) => item.id === comment.id ? comment : item)
      : [...selected.comments, comment];
    const updated = { ...selected, comments };
    setSelected(updated);
    setTasks((current) => current.map((item) => item.id === selected.id ? updated : item));
    setCommentText("");
    setCommentFiles([]);
    setEditingCommentId(null);
    setCommentSaving(false);
  }

  function insertMention(worker: Worker) {
    const tag = `@${workerMentionSlug(worker.name)}`;
    setCommentText((current) => current.replace(/(^|\s)@([a-zA-Z0-9_]*)$/, `$1${tag} `));
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

  function ImagePreviewBlock({ name, url }: { name: string; url: string }) {
    return (
      <div className="overflow-hidden rounded-[22px] border border-black/10 bg-[#FAF7F9]">
        <button type="button" onClick={() => setAttachmentPreview({ name, url, kind: "image" })} className="block w-full bg-white">
          <img src={url} alt={name} className="max-h-[28rem] w-full object-contain" />
        </button>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-black/70">{name}</p>
            <p className="text-xs text-black/40">Immagine in anteprima</p>
          </div>
          <Button type="button" variant="soft" onClick={() => setAttachmentPreview({ name, url, kind: "image" })}>Apri</Button>
        </div>
      </div>
    );
  }

  function TaskRow({ task }: { task: Task }) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => void openTask(task)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") void openTask(task);
        }}
        className="grid w-full cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm md:grid-cols-[auto_1fr_120px_130px_90px]"
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            requestTaskCompletion(task);
          }}
          className={cn("grid size-11 place-items-center rounded-xl transition", isCompletedTask(task) ? "text-emerald-700" : "hover:bg-[#FBE5EE]")}
          aria-label={isCompletedTask(task) ? `Apri task completata: ${task.title}` : `Completa task: ${task.title}`}
        >
          <span className={cn("grid size-5 place-items-center rounded-md border", isCompletedTask(task) ? "border-emerald-600 bg-emerald-600 text-white" : "border-black/20 bg-white")}>
          {task.status === "COMPLETED" ? <Check className="size-3" /> : null}
          </span>
        </button>
        <div className="min-w-0">
          <p className="truncate font-semibold">{task.title}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-black/45">
            <div className="flex -space-x-1 overflow-hidden">
              {task.assignees && task.assignees.length > 0 ? (
                task.assignees.map((assignee) => (
                  <Avatar key={assignee.id} name={assignee.name} photoUrl={assignee.photoUrl} className="inline-block size-5 rounded-full ring-1 ring-white" />
                ))
              ) : (
                <Avatar name="Nessuno" photoUrl={null} className="size-5" />
              )}
            </div>
            <span className="truncate">
              {task.assignees && task.assignees.length > 0 
                ? task.assignees.length === 1 
                  ? task.assignees[0].name 
                  : `${task.assignees.length} collaboratori` 
                : task.assignedToName || "Nessuno"}
            </span>
            <span>·</span>
            <span>{formatTaskDate(task.dueDate)}</span>
          </div>
        </div>
        <span className="hidden text-sm font-medium text-black/55 md:block">{formatCategoryLabel(task.category)}</span>
        <span className="hidden text-sm font-semibold text-black/55 md:block">{statusLabel(task.status)}</span>
        <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
      </div>
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
    { filter: "NEW", label: "Da fare", tasks: newTasks, color: "text-red-600" },
    { filter: "ACTIVE", label: "In corso", tasks: activeTasks, color: "text-yellow-600" },
    { filter: "COMPLETED", label: "Completato", tasks: completedTasks, color: "text-emerald-600" },
    { filter: "WAITING", label: "Fermo", tasks: waitingTasks, color: "text-violet-600" },
  ];
  const boardColumns = [
    { label: "Da fare", tasks: filteredTasks.filter(isNewTask), color: "bg-red-50", text: "text-red-700", filter: "NEW" as TaskFilter },
    { label: "In corso", tasks: filteredTasks.filter(isActiveTask), color: "bg-yellow-50", text: "text-yellow-800", filter: "ACTIVE" as TaskFilter },
    { label: "Completato", tasks: filteredTasks.filter(isCompletedTask), color: "bg-emerald-50", text: "text-emerald-700", filter: "COMPLETED" as TaskFilter },
    { label: "Fermo", tasks: filteredTasks.filter(isWaitingTask), color: "bg-violet-50", text: "text-violet-700", filter: "WAITING" as TaskFilter },
  ];

  return (
    <div className="w-full max-w-none space-y-6">
      <div className="rounded-[32px] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/35">{view === "HOME" ? "Paradise Staff Hub" : "Task"}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">{view === "HOME" ? `Ciao ${userName.split(" ")[0]}` : "Task"}</h1>
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
              onClick={() => setAssignmentFilter("ASSIGNED_TO_ME")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-200 active:scale-95 ${
                assignmentFilter === "ASSIGNED_TO_ME"
                  ? "bg-white text-paradise-noir shadow-sm border border-black/5 dark:bg-white/10 dark:text-white dark:border-white/5"
                  : "text-black/50 hover:text-black hover:bg-black/5 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5"
              }`}
            >
              Assegnate a me ({assignedToMeCount})
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
              Assegnate da me ({assignedByMeCount})
            </button>
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
          </div>
        </div>

        <div className="mt-7 grid grid-cols-5 gap-1.5 sm:gap-4 md:gap-6">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            const isSelected = view === "LIST" && filter === metric.filter;
            return (
              <button
                key={metric.label}
                type="button"
                onClick={() => {
                  setFilter(metric.filter);
                  setView("LIST");
                }}
                className={cn(
                  "flex flex-col items-center justify-center rounded-[22px] border border-black/5 bg-white p-1 py-2.5 sm:p-4 text-center shadow-sm",
                  "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95",
                  isSelected && "ring-2 ring-paradise-pink/60 bg-paradise-softPink/10"
                )}
              >
                <Icon className={cn("size-4 sm:size-6 shrink-0", metric.color)} />
                <p className="mt-1 sm:mt-4 text-base sm:text-3xl font-semibold leading-none sm:leading-tight">{metric.value}</p>
                <p className="text-[8.5px] sm:text-sm text-black/50 leading-tight mt-0.5 sm:mt-1">
                  <span className="inline sm:hidden">{metric.shortLabel}</span>
                  <span className="hidden sm:inline">{metric.label}</span>
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {view === "HOME" ? (
        <>
          {urgentTask ? (
          <button onClick={() => void openTask(urgentTask)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 rounded-[28px] border border-red-200 bg-red-50 p-5 text-left shadow-sm">
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
            <Card className="overflow-hidden bg-white">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Le mie task</h2>
                <button type="button" onClick={() => setView("LIST")} className="text-sm font-bold text-[#C66170]">Vedi lista</button>
              </div>
              <div className="grid max-h-[62dvh] min-w-0 gap-3 overflow-y-auto pr-1">
                {todayTasks.length === 0 ? <p className="rounded-2xl bg-[#FAF7F9] p-4 text-sm text-black/45">Nessuna task di oggi ancora aperta.</p> : null}
                {todayTasks.slice(0, 5).map((task) => <TaskRow key={task.id} task={task} />)}
              </div>
            </Card>
            <Card className="bg-white">
              <h2 className="text-2xl font-semibold">Task in scadenza</h2>
              <div className="mt-5 grid gap-3">
                {expiringTasks.length === 0 ? <p className="rounded-2xl bg-[#FAF7F9] p-4 text-sm text-black/45">Nessuna scadenza aperta.</p> : null}
                {expiringTasks.map((task) => (
                  <button key={task.id} onClick={() => void openTask(task)} className="flex items-center justify-between rounded-2xl border border-black/5 p-4 text-left">
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
                  <button key={task.id} onClick={() => void openTask(task)} className="flex items-center gap-3 rounded-2xl bg-[#FAF7F9] p-4 text-left">
                    <span className={`size-3 rounded-full ${isCompletedTask(task) ? "bg-emerald-500" : isActiveTask(task) ? "bg-yellow-500" : isWaitingTask(task) ? "bg-violet-500" : "bg-red-500"}`} />
                    <div>
                      <p className="font-semibold">{task.title}</p>
                      <p className="text-sm text-black/45">{statusLabel(task.status)} · {formatShortDateTime(task.updatedAt)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
            <Card className="overflow-hidden bg-white">
              <h2 className="text-2xl font-semibold">Commenti recenti</h2>
              <div className="mt-5 grid min-w-0 gap-3">
                {recentComments.length === 0 ? <p className="rounded-2xl bg-[#FAF7F9] p-4 text-sm text-black/45">Nessun commento recente.</p> : null}
                {recentComments.map((comment) => (
                  <button key={comment.id} onClick={() => void openTask(personalTasks.find((task) => task.id === comment.taskId) ?? null)} className="flex min-w-0 items-start gap-3 overflow-hidden rounded-2xl border border-black/5 p-4 text-left">
                    <Avatar name={comment.userName} photoUrl={comment.userPhoto} className="size-9" />
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="truncate font-semibold">{comment.userName}</p>
                      <p className="line-clamp-2 break-words text-sm leading-5 text-black/55">{comment.taskTitle}: {comment.message}</p>
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
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-auto min-w-36"><option value="ALL">Tutti stati</option><option value="DA FARE">Da fare</option><option value="IN CORSO">In corso</option><option value="COMPLETATO">Completato</option><option value="FERMO">Fermo</option></Select>
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
                    <td className="cursor-pointer px-4 py-4 font-semibold" onClick={() => void openTask(task)}>{task.title}</td>
                    <td className="px-4 py-4"><span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${statusClasses(task.status)}`}>{statusLabel(task.status)}</span></td>
                    <td className="px-4 py-4"><Badge tone={priorityTone(task.priority)}>{task.priority}</Badge></td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-2">
                        <div className="flex -space-x-1.5 overflow-hidden">
                          {task.assignees && task.assignees.length > 0 ? (
                            task.assignees.map((assignee) => (
                              <Avatar key={assignee.id} name={assignee.name} photoUrl={assignee.photoUrl} className="inline-block size-7 rounded-full ring-2 ring-white" />
                            ))
                          ) : (
                            <Avatar name="Nessuno" photoUrl={null} className="size-7" />
                          )}
                        </div>
                        <span className="truncate max-w-[150px]">
                          {task.assignees && task.assignees.length > 0 
                            ? task.assignees.length === 1 
                              ? task.assignees[0].name 
                              : `${task.assignees.length} collaboratori` 
                            : task.assignedToName || "Nessuno"}
                        </span>
                      </span>
                    </td>
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
                    <button key={task.id} onClick={() => void openTask(task)} className="rounded-2xl border border-black/5 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
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
                          <div className="flex -space-x-1.5 overflow-hidden">
                            {task.assignees && task.assignees.length > 0 ? (
                              task.assignees.map((assignee) => (
                                <Avatar key={assignee.id} name={assignee.name} photoUrl={assignee.photoUrl} className="inline-block size-6 rounded-full ring-2 ring-white" />
                              ))
                            ) : (
                              <Avatar name="Nessuno" photoUrl={null} className="size-6" />
                            )}
                          </div>
                          <span className="truncate">
                            {task.assignees && task.assignees.length > 0 
                              ? task.assignees.length === 1 
                                ? task.assignees[0].name 
                                : `${task.assignees.length} collaboratori` 
                              : task.assignedToName || "Nessuno"}
                          </span>
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
                            onClick={() => void openTask(task)}
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
        <GlobalFullscreenLayer className="bg-[#F8F3F6]">
        <div ref={taskDetailPageRef} className="task-detail-page h-full w-full overflow-y-auto overscroll-contain bg-[#F8F3F6]">
          <div className="mx-auto min-h-full w-full max-w-[1440px] space-y-3 px-3 pb-28 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:pt-4 md:pb-24 xl:px-7 xl:pt-3">
            <div className="overflow-hidden rounded-[24px] border border-black/5 bg-white shadow-sm">
              <div className="grid gap-0 md:grid-cols-[minmax(0,1.25fr)_220px_minmax(220px,0.65fr)_minmax(220px,0.65fr)_auto] md:items-stretch">
                <div className="flex min-w-0 items-center gap-3 border-b border-black/5 p-4 md:border-b-0 md:border-r">
                  <button onClick={() => void openTask(null)} className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#FAF7F9] shadow-sm"><ArrowLeft className="size-5" /></button>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="min-w-0 whitespace-normal break-words text-xl font-black leading-tight tracking-tight sm:text-2xl md:text-3xl">{selected.title}</h1>
                      <Badge tone={selected.status === "COMPLETED" ? "green" : "gold"}>{statusLabel(selected.status)}</Badge>
                    </div>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-black/35">{formatCategoryLabel(selected.category)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 border-b border-black/5 p-4 md:border-b-0 md:border-r">
                  <CalendarDays className="size-5 shrink-0 text-black/45" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-black/35">Scadenza</p>
                    <p className="text-sm font-black">{formatFullDate(selected.dueDate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 border-b border-black/5 p-4 md:border-b-0 md:border-r">
                  <Avatar name={selected.createdByName} photoUrl={selected.createdByPhoto ?? null} className="size-9" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-black/35">Assegnata da</p>
                    <p className="truncate text-sm font-black">{selected.createdByName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 border-b border-black/5 p-4 md:border-b-0 md:border-r">
                  {selected.assignees && selected.assignees.length === 1 ? (
                    <Avatar name={selected.assignees[0].name} photoUrl={selected.assignees[0].photoUrl} className="size-9" />
                  ) : (
                    <div className="flex -space-x-2">
                      {(selected.assignees.length > 0 ? selected.assignees : [{ id: selected.assignedToId, name: selected.assignedToName || "Nessuno", photoUrl: selected.assignedToPhoto }]).slice(0, 4).map((assignee) => (
                        <Avatar key={assignee.id || assignee.name} name={assignee.name} photoUrl={assignee.photoUrl ?? null} className="size-9 ring-2 ring-white" />
                      ))}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-black/35">Assegnata a</p>
                    <p className="truncate text-sm font-black">
                      {selected.assignees && selected.assignees.length > 0
                        ? selected.assignees.length === 1 ? selected.assignees[0].name : `${selected.assignees.length} collaboratori`
                        : selected.assignedToName || "Nessuno"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end p-4">
                  {canAssign || selected.createdById === userId ? (
                    <button onClick={() => openEditTask(selected)} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#FAF7F9] px-4 text-sm font-black shadow-sm">
                      <Pencil className="size-4" /> <span className="hidden sm:inline">Modifica task</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            {selectedLoading ? (
              <div className="flex items-center gap-3 rounded-[22px] border border-[#8064D8]/15 bg-white px-5 py-4 shadow-sm" role="status" aria-live="polite">
                <span className="size-5 animate-spin rounded-full border-2 border-[#8064D8]/20 border-t-[#8064D8]" />
                <div>
                  <p className="text-sm font-black">Apro la task</p>
                  <p className="text-xs text-black/45">Caricamento di immagini, allegati, note e commenti…</p>
                </div>
              </div>
            ) : null}
            {selectedExtrasLoading && !selectedLoading ? (
              <div className="flex items-center gap-3 rounded-[22px] border border-black/5 bg-white/80 px-5 py-3 text-black/55 shadow-sm" role="status" aria-live="polite">
                <span className="size-4 animate-spin rounded-full border-2 border-black/10 border-t-[#8064D8]" />
                <p className="text-xs font-bold">La task è pronta. Immagini, allegati e commenti stanno arrivando…</p>
              </div>
            ) : null}
            {selectedLoadError ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-red-200 bg-red-50 px-5 py-4 text-red-800">
                <p className="text-sm font-bold">{selectedLoadError}</p>
                <button type="button" onClick={() => void openTask(selected)} className="rounded-xl bg-white px-4 py-2 text-xs font-black shadow-sm">Riprova</button>
              </div>
            ) : null}
            <div className={cn("grid gap-4 xl:grid-cols-[minmax(320px,410px)_minmax(0,1fr)] xl:items-start", selectedLoading ? "pointer-events-none opacity-45" : "")}>
            <div className="space-y-4 xl:sticky xl:top-4">
            <Card className="bg-white p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Descrizione</h2>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-black/10 px-3 py-2 text-xs font-bold text-black/60 transition hover:bg-[#FAF7F9] hover:text-[#C66170]">
                  <FileImage className="size-4" /> Immagine
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => { void attachDescriptionImage(event.target.files?.[0]); event.currentTarget.value = ""; }} />
                </label>
              </div>
              <p className="mt-3 text-sm leading-6 text-black/55 whitespace-pre-wrap">{renderTextWithLinks(selected.description)}</p>
              {selected.photoUrl || selected.attachmentUrl || selected.attachmentName ? (
                <div className="mt-4">
                  {selected.photoUrl ? (
                    <ImagePreviewBlock name={selected.attachmentName ?? "Immagine descrizione"} url={selected.photoUrl} />
                  ) : (
                    <AttachmentCard name={selected.attachmentName ?? "Allegato task"} url={selected.attachmentUrl} />
                  )}
                </div>
              ) : null}
              {selected.linkUrl ? <a className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#8064D8]" href={selected.linkUrl} target="_blank"><LinkIcon className="size-4" /> Apri link</a> : null}
            </Card>

            {selected.checklist && selected.checklist.length > 0 ? (
              <Card className="bg-white p-4 md:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold">Checklist</h2>
                  <span className="text-sm font-semibold text-[#8064D8]">
                    {selected.checklist.filter((item) => item.done).length}/{selected.checklist.length} completate
                  </span>
                </div>
                <div className="grid gap-3">
                  {selected.checklist.map((item, index) => (
                    <button
                      type="button"
                      key={`${item.text}-${index}`}
                      onClick={() => void toggleChecklistItem(index)}
                      className="flex min-h-14 w-full items-start gap-3 rounded-xl p-2 text-left transition hover:bg-black/5"
                    >
                      <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border ${item.done ? "bg-[#8064D8] text-white" : "border-black/20"}`}>
                        {item.done ? <Check className="size-4" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm font-semibold", item.done && "text-black/45 line-through")}>{item.text}</span>
                        {item.done && (item.completedBy || item.completedAt) ? (
                          <span className="mt-1 block text-[11px] font-medium text-black/40">
                            Completata{item.completedBy ? ` da ${item.completedBy}` : ""}{item.completedAt ? ` · ${new Date(item.completedAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}` : ""}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>
              </Card>
            ) : null}
            </div>
            <div className="min-w-0 space-y-5">

            {/* Prova completamento (se presente) */}
            {(selected.completionNote || selected.completionLinks.length > 0 || selected.completionFiles.length > 0) ? (
              <Card className="bg-white p-4 md:p-5">
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

            {/* Timeline Feed Cronologico Unificato */}
            <Card className="bg-white p-4 md:p-5">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-black/5 pb-3">
                <div>
                  <h2 className="font-semibold">Attività e cronologia</h2>
                  <p className="mt-1 text-xs text-black/45">Il flusso storico di tutti gli eventi, commenti e note della task.</p>
                </div>
                <Badge tone="dark">{timelineEvents.length}</Badge>
              </div>

              {/* Timeline feed (scrollable list) */}
              <div className="max-h-[320px] overflow-y-auto pr-2 -mr-2 scrollbar-thin xl:max-h-[360px]">
                <div className="relative ml-2 space-y-4 border-l border-black/10 py-1 pl-4 md:ml-3 md:space-y-5 md:pl-5">
                  {timelineEvents.map((event, idx) => {
                    const isComment = event.type === "comment";

                    return (
                      <div key={idx} className="relative">
                        {/* Timeline dot */}
                        <span className="absolute -left-[27px] top-1.5 size-3.5 rounded-full border-2 border-white bg-[#C66170] shadow-xs" />

                        {isComment ? (
                          /* Comment Element */
                          <div className="rounded-2xl border border-black/5 bg-[#FAF7F9]/30 p-3 transition animate-in fade-in duration-200 hover:bg-[#FAF7F9]/50 md:p-4">
                            <div className="flex items-start gap-3">
                              <Avatar name={event.commentUser || "Collaboratore"} photoUrl={event.commentPhoto ?? null} className="size-8" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold">{event.commentUser}</p>
                                    <p className="text-[10px] text-black/45">{formatShortDateTime(event.date.toISOString())}</p>
                                  </div>
                                  {event.commentUserId === userId ? (
                                    <button 
                                      type="button" 
                                      onClick={() => { 
                                        setEditingCommentId(event.commentId || null); 
                                        setCommentText(event.message || ""); 
                                        setCommentFiles(event.files || []);
                                      }} 
                                      className="text-xs font-semibold text-[#8064D8] hover:underline"
                                    >
                                      Modifica
                                    </button>
                                  ) : null}
                                </div>
                                {event.message && (
                                  <p className="mt-2 text-sm leading-6 text-black/70 whitespace-pre-wrap">{renderTextWithLinks(event.message)}</p>
                                )}
                                
                                {/* Attached files */}
                                {event.files && event.files.length > 0 && (
                                  <div className="mt-3 grid gap-2">
                                    {event.files.map((file: any, fileIdx: number) => {
                                      const previewUrl = taskFilePreviewUrl(file);
                                      const isImage = previewUrl?.startsWith("data:image/") || previewUrl?.startsWith("/api/drive-image") || file.name?.match(/\.(jpeg|jpg|gif|png|webp|avif)/i);
                                      return (
                                        <div key={fileIdx} className="max-w-md">
                                          {isImage ? (
                                            <ImagePreviewBlock name={file.name} url={previewUrl} />
                                          ) : (
                                            <AttachmentCard name={file.name} url={previewUrl || file.driveFileUrl || file.url} />
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* System Event Element */
                          <div className="text-sm animate-in fade-in duration-200">
                            <div className="flex items-center gap-2">
                              {event.user ? (
                                <Avatar name={event.user.name} photoUrl={event.user.photoUrl} className="size-5 shrink-0" />
                              ) : null}
                              <span className="font-semibold text-black/80">{event.title}</span>
                              <span className="text-[10px] text-black/40 font-normal ml-auto shrink-0">{formatShortDateTime(event.date.toISOString())}</span>
                            </div>
                            {event.description && (
                              <p className="mt-1 text-xs text-black/50 ml-7">{event.description}</p>
                            )}

                            {/* Completion Proof Files */}
                            {event.files && event.files.length > 0 && (
                              <div className="mt-2 ml-7 grid gap-2 max-w-md">
                                {event.files.map((file: any, fileIdx: number) => (
                                  <AttachmentCard key={fileIdx} name={file.name} url={file.url} />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Comment Input Box at bottom of timeline */}
              <div className="mt-4 space-y-3 border-t border-black/5 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-black/45">
                  {editingCommentId ? "Modifica il commento" : "Aggiungi commento o nota"}
                </h3>
                <div className="rounded-2xl border border-black/10 bg-[#FAF7F9]/40 p-3">
                  <textarea 
                    className="min-h-16 w-full resize-none rounded-xl border border-black/5 bg-white px-3 py-2 text-sm shadow-xs outline-none transition focus:border-[#8064D8] md:min-h-20" 
                    value={commentText} 
                    onChange={(event) => setCommentText(event.target.value)} 
                    placeholder="Scrivi un aggiornamento, nota o commento... usa @nome per taggare una persona" 
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-black/40">Tag: scrivi @nome oppure scegli</span>
                    {mentionSuggestions.map((worker) => (
                      <button
                        key={worker.id}
                        type="button"
                        onClick={() => insertMention(worker)}
                        title={`Tagga ${worker.name} · ${workerMentionRoleLabel(worker)}`}
                        className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#8064D8] ring-1 ring-black/5 hover:bg-[#F5F1FF]"
                      >
                        @{workerMentionSlug(worker.name)}
                        <span className="ml-1 font-semibold text-black/35">· {workerMentionRoleLabel(worker)}</span>
                      </button>
                    ))}
                    {mentionedWorkers.map((worker) => (
                      <span key={worker.id} className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700">
                        Notifica a {worker.name}
                      </span>
                    ))}
                  </div>
                  
                  {/* File Upload Previews */}
                  {commentFiles.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-black/[0.02] p-2">
                      {commentFiles.map((file, idx) => {
                        const previewUrl = taskFilePreviewUrl(file);
                        return (
                        <div key={idx} className="relative flex items-center gap-2 rounded-lg bg-white px-2 py-1 text-xs font-medium border border-black/5 shadow-2xs">
                          {previewUrl && attachmentKind(previewUrl, file.name) === "image" ? (
                            <img src={previewUrl} alt={file.name} className="size-10 rounded-md object-cover" />
                          ) : null}
                          <span className="truncate max-w-[120px]">{file.name}</span>
                          <button 
                            type="button" 
                            onClick={() => removeCommentFile(idx)} 
                            className="text-black/40 hover:text-black"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 text-xs font-bold text-black/60 transition hover:bg-[#FAF7F9] hover:text-[#C66170]">
                        <FileImage className="size-4" /> Foto
                        <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => { void attachCommentFiles(event.target.files); event.currentTarget.value = ""; }} />
                      </label>
                      <label className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 text-xs font-bold text-black/60 transition hover:bg-[#FAF7F9] hover:text-[#C66170]">
                        <Paperclip className="size-4" /> File / PDF
                        <input type="file" accept="application/pdf,.pdf,*/*" multiple className="hidden" onChange={(event) => { void attachCommentFiles(event.target.files); event.currentTarget.value = ""; }} />
                      </label>
                    </div>
                    
                    <div className="flex gap-2 sm:justify-end">
                      {editingCommentId && (
                        <Button variant="soft" className="h-9 text-xs" onClick={() => { setEditingCommentId(null); setCommentText(""); setCommentFiles([]); }}>
                          Annulla
                        </Button>
                      )}
                      <Button className="h-9 min-w-24 text-xs" disabled={commentUploading || commentSaving} onClick={saveComment}>
                        <Send className="size-3.5" /> {commentSaving ? "Salvo..." : editingCommentId ? "Salva" : "Invia"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
            {(selected.status === "ACTIVE" || selected.status === "WAITING" || selected.timerSeconds > 0) ? (
              <Card className="bg-white p-4 md:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-black/45">
                      <Timer className="size-4 text-[#C66170]" />
                      Cronometro lavorativo
                    </p>
                    <p className="mt-2 text-3xl font-black tabular-nums tracking-tight text-black md:text-4xl">
                      {formatTimerWithDays(getTaskCurrentSeconds(selected, todayAttendanceLogs))}
                    </p>
                    <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${timerAttendance.tone === "work" ? "bg-emerald-50 text-emerald-700" : timerAttendance.tone === "pause" ? "bg-amber-50 text-amber-700" : "bg-black/5 text-black/45"}`}>
                      {timerAttendance.label}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:min-w-60">
                    <div className="rounded-2xl bg-[#FAF7F9] p-3 md:p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-black/35">Giorni totali</p>
                      <p className="mt-1 text-2xl font-black">{totalTaskDays(selected)}</p>
                    </div>
                    <div className="rounded-2xl bg-[#FAF7F9] p-3 md:p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-black/35">Stato task</p>
                      <p className="mt-1 text-sm font-black">{statusLabel(selected.status)}</p>
                    </div>
                  </div>
                </div>
                <p className="mt-4 rounded-2xl bg-[#FAF7F9] p-3 text-xs leading-5 text-black/45">
                  Conta solo quando la timbratura risulta in lavoro. In pausa o dopo uscita il cronometro resta fermo.
                </p>
              </Card>
            ) : null}
            {isCompletedTask(selected) ? null : (
            <div className="sticky bottom-2 z-10 grid grid-cols-1 gap-2 rounded-[20px] border border-black/5 bg-white/95 p-2 shadow-xl backdrop-blur sm:grid-cols-2 md:bottom-4 md:gap-3 md:rounded-[24px] md:p-3">
              {isNewTask(selected) ? (
                <Button className="sm:col-span-2" onClick={() => { void updateStatus(selected, "ACTIVE"); }}>
                  <Clock3 className="size-4" /> Metti in corso
                </Button>
              ) : (
                <>
                  <Button 
                    variant="soft" 
                    onClick={() => { 
                      if (selected.status === "ACTIVE") {
                        void updateStatus(selected, "WAITING");
                      } else {
                        void updateStatus(selected, "ACTIVE");
                      }
                    }}
                  >
                    {selected.status === "ACTIVE" ? "Metti fermo" : selected.timerSeconds > 0 ? "Riprendi in corso" : "Metti in corso"}
                  </Button>
                  <Button onClick={() => requestTaskCompletion(selected)}><CheckCircle2 className="size-4" /> Completa task</Button>
                </>
              )}
            </div>
            )}
            </div>
            </div>
          </div>
        </div>
        </GlobalFullscreenLayer>
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

      {completionTarget ? (
        <GlobalFullscreenLayer className="grid place-items-center overflow-y-auto bg-black/40 p-4 backdrop-blur-md">
          <div className="my-auto w-full max-w-xl rounded-[28px] border border-white/70 bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/35">Completamento</p>
                <h2 className="mt-2 text-2xl font-semibold">Invia prova task</h2>
                <p className="mt-1 font-semibold text-black/70">{completionTarget.title}</p>
                <p className="mt-1 text-sm text-black/50">Tempo registrato: {formatTimerWithDays(getTaskCurrentSeconds(completionTarget, todayAttendanceLogs))}</p>
              </div>
              <button onClick={() => setCompletionTarget(null)} disabled={completionSaving} className="grid size-11 place-items-center rounded-full border border-black/10 disabled:opacity-40" aria-label="Chiudi completamento"><X className="size-5" /></button>
            </div>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-black/55">Azione svolta</span>
                <textarea className="min-h-28 rounded-2xl border border-black/10 px-4 py-3 text-sm leading-6 outline-none focus:border-[#D96B94] focus:ring-4 focus:ring-[#D96B94]/15" value={completion.note} onChange={(event) => { setCompletion({ ...completion, note: event.target.value }); setCompletionError(""); }} placeholder="Scrivi cosa è stato fatto..." />
              </label>
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
              {completionError ? <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{completionError}</p> : null}
              <Button disabled={completionSaving} onClick={async () => {
                if (!completion.note.trim()) {
                  setCompletionError("Scrivi l’azione svolta prima di completare la Task.");
                  return;
                }
                const links = completion.link.trim() ? [completion.link.trim()] : [];
                setCompletionSaving(true);
                setCompletionError("");
                const result = await updateStatus(completionTarget, "COMPLETED", { completionNote: completion.note.trim(), completionLinks: links, completionFiles: completion.files });
                setCompletionSaving(false);
                if (!result.ok) {
                  setCompletionError(result.error);
                  return;
                }
                setCompletionTarget(null);
              }}><Send className="size-4" /> {completionSaving ? "Salvataggio..." : "Invia e completa"}</Button>
            </div>
          </div>
        </GlobalFullscreenLayer>
      ) : null}

      {open ? (
        <GlobalFullscreenLayer className="bg-black/35 backdrop-blur-md">
          <section className="ml-auto grid h-full w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-[#F8F6F7] text-[#17151A] shadow-[-24px_0_80px_rgba(31,17,24,0.18)] sm:max-w-3xl sm:border-l sm:border-white/70">
            <header className="flex items-center justify-between gap-4 border-b border-black/[0.08] bg-white/90 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl sm:px-8 sm:py-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#A74758]">{editingTaskId ? "Modifica task" : "Nuova task"}</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{editingTaskId ? "Aggiorna task" : "Crea task"}</h2>
              </div>
              <button type="button" onClick={resetTaskForm} className="grid size-11 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-black/70 shadow-sm transition hover:bg-black hover:text-white" aria-label="Chiudi creazione task"><X className="size-5" /></button>
            </header>

            <main className="min-h-0 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8 sm:py-8">
              <div className="grid gap-6">
              <label className="space-y-2"><span className="text-xs font-black uppercase tracking-[0.12em] text-black/55">Titolo *</span><Field value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Controllare prenotazioni serali" /></label>
              <label className="space-y-2"><span className="text-xs font-black uppercase tracking-[0.12em] text-black/55">Descrizione</span><textarea className="min-h-32 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm leading-6 shadow-sm outline-none transition focus:border-paradise-pink focus:ring-4 focus:ring-paradise-pink/20" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2"><span className="text-xs font-black uppercase tracking-[0.12em] text-black/55">Scadenza</span><Field type="datetime-local" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>
                <label className="space-y-2"><span className="text-xs font-black uppercase tracking-[0.12em] text-black/55">Priorità</span><Select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="ALTA">Alta</option><option value="MEDIA">Media</option><option value="BASSA">Bassa</option></Select></label>
                <div className="space-y-2 md:col-span-2">
                  <span className="block text-xs font-black uppercase tracking-[0.12em] text-black/55">Assegna a <span className="normal-case tracking-normal text-black/40">· {canAssignAcrossTeam ? "seleziona una o più persone" : "Admin o Responsabile"}</span></span>
                  <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto rounded-2xl border border-black/10 bg-white p-3 shadow-sm sm:grid-cols-2">
                    {initialAllowedWorkers.map((worker) => {
                      const isSelected = form.assignedToIds.includes(worker.id);
                      return (
                        <button
                          key={worker.id}
                          type="button"
                          onClick={() => {
                            const newIds = isSelected
                              ? form.assignedToIds.filter((id) => id !== worker.id)
                              : [...form.assignedToIds, worker.id];
                            setForm({ 
                              ...form, 
                              assignedToIds: newIds, 
                              assignedToId: newIds[0] ?? "" 
                            });
                          }}
                          className={`flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-bold transition-all ${
                            isSelected 
                              ? "bg-[#FBE5EE] text-[#7F2945] ring-2 ring-[#D96B94]/45"
                              : "bg-[#F8F6F7] text-black/65 ring-1 ring-black/[0.06] hover:bg-white hover:text-black"
                          }`}
                        >
                          <Avatar name={worker.name} photoUrl={worker.photoUrl} className="size-6" />
                          <span className="min-w-0 flex-1 truncate">{worker.name}</span>
                          {isSelected ? <Check className="size-4 shrink-0" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <fieldset className="space-y-3">
                <legend className="text-xs font-black uppercase tracking-[0.12em] text-black/55">Checklist</legend>
                <div className="space-y-2">
                  {form.checklistItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-[28px_minmax(0,1fr)_44px] items-center gap-2 rounded-2xl border border-black/10 bg-white p-2 shadow-sm">
                      <span className="grid size-7 place-items-center rounded-lg bg-[#FBE5EE] text-xs font-black text-[#A74758]">{index + 1}</span>
                      <input
                        value={item}
                        onChange={(event) => setForm((current) => ({ ...current, checklistItems: current.checklistItems.map((entry, itemIndex) => itemIndex === index ? event.target.value : entry) }))}
                        placeholder={index === 0 ? "Scrivi una voce della checklist" : "Altra voce"}
                        className="min-h-11 w-full bg-transparent px-2 text-sm font-semibold outline-none placeholder:text-black/30"
                      />
                      <button
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, checklistItems: current.checklistItems.length === 1 ? [""] : current.checklistItems.filter((_, itemIndex) => itemIndex !== index) }))}
                        className="grid size-11 place-items-center rounded-xl text-black/35 transition hover:bg-red-50 hover:text-red-600"
                        aria-label={`Rimuovi voce ${index + 1}`}
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, checklistItems: [...current.checklistItems, ""] }))}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-[#D96B94]/55 bg-[#FFF4F8] px-4 text-sm font-black text-[#8E334E] transition hover:border-[#A74758] hover:bg-[#FBE5EE]"
                >
                  <Plus className="size-4" /> Aggiungi voce
                </button>
              </fieldset>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className="grid min-h-20 cursor-pointer place-items-center gap-1 rounded-2xl border border-black/10 bg-white p-3 text-sm font-bold shadow-sm transition hover:border-[#D96B94]/45"><Paperclip className="size-5 text-[#A74758]" />Allega file<input type="file" className="hidden" onChange={(event) => void attachMainFile(event.target.files?.[0])} /></label>
                <label className="grid min-h-20 cursor-pointer place-items-center gap-1 rounded-2xl border border-black/10 bg-white p-3 text-sm font-bold shadow-sm transition hover:border-[#D96B94]/45"><FileImage className="size-5 text-[#A74758]" />Foto<input type="file" accept="image/*" className="hidden" onChange={(event) => void attachPhoto(event.target.files?.[0])} /></label>
                <label className="col-span-2 flex items-center"><span className="sr-only">Link</span><Field value={form.linkUrl} onChange={(event) => setForm({ ...form, linkUrl: event.target.value })} placeholder="https:// link" /></label>
              </div>
              {form.attachmentName ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                  <span className="flex min-w-0 items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span className="truncate">File caricato: {form.attachmentName}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, attachmentName: "", photoUrl: "" })}
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-emerald-900 shadow-sm ring-1 ring-emerald-200"
                    aria-label="Rimuovi file caricato"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : null}
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
              </div>
            </main>

            <footer className="grid grid-cols-[auto_1fr] gap-3 border-t border-black/[0.08] bg-white/92 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl sm:px-8 sm:py-5">
              <Button variant="soft" onClick={resetTaskForm}>Annulla</Button>
              <Button onClick={editingTaskId ? saveTaskEdit : createTask} disabled={saving} className="w-full justify-center">
                <Send className="size-4" /> {saving ? "Salvo..." : editingTaskId ? "Salva modifiche" : "Crea task"}
              </Button>
            </footer>
          </section>
        </GlobalFullscreenLayer>
      ) : null}
    </div>
  );
}
