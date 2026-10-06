"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Search, 
  SlidersHorizontal, 
  Video, 
  X, 
  Upload, 
  Trash2, 
  ExternalLink,
  Instagram,
  CheckCircle,
  FileText,
  Clock,
  Sparkles,
  Info,
  Layers,
  MessageSquare,
  Send, Heart, Bookmark, MoreHorizontal, Home, Signal, Wifi, BatteryFull
} from "lucide-react";
import { Button, Card, Field } from "@/components/ui";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { cn } from "@/lib/utils";
import { parseSocialSchedule, validateSocialSchedule } from "@/lib/social-post-schedule";
import styles from "./social-calendar.module.css";

type SocialPost = {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  platform: string;
  status: string;
  cover_url: string | null;
  video_url: string | null;
  notes: string | null;
  brand: string;
  created_by_id: string;
  created_by: {
    id: string;
    name: string;
    photo_url: string | null;
  };
};

const PLATFORMS = [
  { id: "INSTAGRAM", name: "Instagram", color: "from-purple-600 to-pink-500", bgLight: "bg-pink-50 dark:bg-pink-950/20", text: "text-pink-600 dark:text-pink-400" },
  { id: "TIKTOK", name: "TikTok", color: "from-neutral-900 to-neutral-800 dark:from-neutral-800 dark:to-neutral-700", bgLight: "bg-neutral-100 dark:bg-neutral-900/40", text: "text-neutral-800 dark:text-neutral-300" },
  { id: "YOUTUBE", name: "YouTube", color: "from-red-600 to-red-500", bgLight: "bg-red-50 dark:bg-red-950/20", text: "text-red-600 dark:text-red-400" },
  { id: "FACEBOOK", name: "Facebook", color: "from-blue-600 to-blue-500", bgLight: "bg-blue-50 dark:bg-blue-950/20", text: "text-blue-600 dark:text-blue-400" },
  { id: "ALTRO", name: "Altro / Canale", color: "from-teal-600 to-teal-500", bgLight: "bg-teal-50 dark:bg-teal-950/20", text: "text-teal-600 dark:text-teal-400" }
];

const getPlatformsList = (platformStr: string) => {
  if (!platformStr) return [];
  return platformStr
    .split(",")
    .map((p) => PLATFORMS.find((plat) => plat.id === p.trim()))
    .filter((plat): plat is typeof PLATFORMS[0] => !!plat);
};

const getLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const STATUSES = [
  { id: "RECORDED", name: "Registrato", color: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400" },
  { id: "DRAFT", name: "Bozza", color: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/30" },
  { id: "PLANNED", name: "Programmato", color: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/30" },
  { id: "PUBLISHED", name: "Pubblicato", color: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/30" }
];

const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export function SocialCalendar({ 
  initialPosts, 
  currentUserId 
}: { 
  initialPosts: any[]; 
  currentUserId: string;
}) {
  const [posts, setPosts] = useState<SocialPost[]>(initialPosts);
  
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/social-calendar", { cache: "no-store", signal: controller.signal });
        if (response.ok) { const data = await response.json(); if (active) setPosts(data); }
      } catch { /* Existing contents remain visible during transient failures. */ }
    };
    const timer = setInterval(() => void refresh(), 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { active = false; controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  // Calendar Navigation State
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("ALL");
  const [selectedAuthor, setSelectedAuthor] = useState("ALL");
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"MONTH" | "LIST">("MONTH");
  
  const [statusSaving, setStatusSaving] = useState<string | null>(null);
  const [listFeedback, setListFeedback] = useState("");
  const [scheduleRow, setScheduleRow] = useState<string | null>(null);
  const [listSchedule, setListSchedule] = useState("");

  async function updateListStatus(post: SocialPost, status: string, scheduledAt?: string) {
    setStatusSaving(post.id);
    setListFeedback("");
    try {
      const response = await fetch("/api/social-calendar", {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:post.id,status,scheduledAt})});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossibile aggiornare lo stato.");
      setPosts(previous => previous.map(item => item.id === result.id ? result : item));
      setScheduleRow(null);
      setListFeedback("Stato aggiornato.");
    } catch (error) {
      setListFeedback(error instanceof Error ? error.message : "Impossibile aggiornare lo stato.");
    } finally { setStatusSaving(null); }
  }

  // Modal / Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [formMode, setFormMode] = useState<"VIEW" | "EDIT">("VIEW");
  
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isFormOpen) return;
    const frame = requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({block:"start"});
      editorRef.current?.querySelector<HTMLElement>("#social-editor-title")?.focus({preventScroll:true});
    });
    return () => cancelAnimationFrame(frame);
  }, [isFormOpen]);

  // Form Fields State
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formScheduledDate, setFormScheduledDate] = useState("");
  const [formScheduledTime, setFormScheduledTime] = useState("12:00");
  const [formPlatforms, setFormPlatforms] = useState<string[]>(["INSTAGRAM"]);
  const [formBrands, setFormBrands] = useState<string[]>(["PARADISE"]);
  const [formStatus, setFormStatus] = useState("DRAFT");
  const [formCoverUrl, setFormCoverUrl] = useState("");
  const [formVideoUrl, setFormVideoUrl] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  useEffect(() => {
    if (formMode !== "VIEW" || !editingPost) return;
    const updated = posts.find(post => post.id === editingPost.id);
    if (updated && updated.status !== editingPost.status) { setEditingPost(updated); setFormStatus(updated.status); }
  }, [posts, formMode, editingPost]);

  // Drag & Drop States
  const [draggedOverDate, setDraggedOverDate] = useState<string | null>(null);

  // Comments State
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentMessage, setNewCommentMessage] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Fetch comments helper
  async function fetchComments(postId: string) {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/social-calendar/comments?postId=${postId}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (err) {
      console.error("Errore caricamento commenti:", err);
    } finally {
      setLoadingComments(false);
    }
  }

  // Add comment helper
  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newCommentMessage.trim() || !editingPost) return;

    setSubmittingComment(true);
    try {
      const res = await fetch("/api/social-calendar/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: editingPost.id, message: newCommentMessage }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...prev, data]);
        setNewCommentMessage("");
      } else {
        const errData = await res.json();
        alert(errData.error || "Errore durante l'aggiunta del commento");
      }
    } catch (err) {
      console.error("Errore invio commento:", err);
    } finally {
      setSubmittingComment(false);
    }
  }

  // Delete comment helper
  async function handleDeleteComment(commentId: string) {
    if (!confirm("Sei sicuro di voler eliminare questo commento?")) return;
    try {
      const res = await fetch(`/api/social-calendar/comments?id=${commentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      } else {
        const errData = await res.json();
        alert(errData.error || "Errore durante l'eliminazione del commento");
      }
    } catch (err) {
      console.error("Errore eliminazione commento:", err);
    }
  }

  // Drag & Drop handlers
  function handleDragStart(e: React.DragEvent, postId: string) {
    e.dataTransfer.setData("text/plain", postId);
    e.dataTransfer.effectAllowed = "move";
  }

  async function handleDrop(e: React.DragEvent, targetDate: Date) {
    e.preventDefault();
    setDraggedOverDate(null);
    const postId = e.dataTransfer.getData("text/plain");
    if (!postId) return;

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const originalTime = new Intl.DateTimeFormat("it-IT", { timeZone:"Europe/Rome", hour:"2-digit", minute:"2-digit" }).format(new Date(post.scheduled_at));
    const targetInstant = parseSocialSchedule(`${getLocalDateString(targetDate)}T${originalTime}:00`);
    const scheduleError = validateSocialSchedule(post.status, targetInstant);
    if (scheduleError) { alert(scheduleError); return; }
    const newScheduledAtStr = targetInstant!.toISOString();

    const originalPosts = [...posts];
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, scheduled_at: newScheduledAtStr } : p
      )
    );

    try {
      const response = await fetch("/api/social-calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: post.id,
          title: post.title,
          description: post.description,
          scheduledAt: newScheduledAtStr,
          platform: post.platform,
          status: post.status,
          coverUrl: post.cover_url,
          videoUrl: post.video_url,
          notes: post.notes,
          brand: post.brand,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Errore nello spostamento del post.");
      }

      const updatedPost = await response.json();
      setPosts((prev) =>
        prev.map((p) => (p.id === updatedPost.id ? updatedPost : p))
      );
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Impossibile spostare il post.");
      setPosts(originalPosts);
    }
  }

  // Year & Month calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    // getDay() is 0 for Sunday, 1 for Monday... map to Lun=0 ... Dom=6
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday
    
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(year, month, 0).getDate();
    
    const days: { date: Date; isCurrentMonth: boolean; key: string }[] = [];
    
    // Fill previous month days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, totalDaysInPrevMonth - i);
      days.push({ date: d, isCurrentMonth: false, key: `prev-${d.getDate()}` });
    }
    
    // Fill current month days
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true, key: `curr-${i}` });
    }
    
    // Fill next month days to complete 42 cells (6 rows)
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false, key: `next-${i}` });
    }
    
    return days;
  }, [year, month]);

  // Navigate calendar months
  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }
  
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }
  
  function setToday() {
    setCurrentDate(new Date());
  }

  // Filter posts
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesSearch = 
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (post.description && post.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (post.notes && post.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesBrand = selectedBrand === "ALL" || (post.brand ? post.brand.split(",").includes(selectedBrand) : false);
      const matchesStatus = selectedStatus === "ALL" || post.status === selectedStatus;
      
      return matchesSearch && matchesBrand && matchesStatus
        && (selectedPlatform === "ALL" || post.platform.split(",").map(p => p.trim()).includes(selectedPlatform))
        && (selectedAuthor === "ALL" || post.created_by_id === selectedAuthor);
    });
  }, [posts, searchQuery, selectedBrand, selectedStatus, selectedPlatform, selectedAuthor]);

  // Group filtered posts by date key (YYYY-MM-DD) for Month View
  const postsByDate = useMemo(() => {
    const map: Record<string, SocialPost[]> = {};
    filteredPosts.forEach((post) => {
      const dateKey = new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/Rome"}).format(new Date(post.scheduled_at));
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(post);
    });
    return map;
  }, [filteredPosts]);

  // Open the creation page for a specific day
  function openCreateForDate(date: Date) {
    const dateStr = getLocalDateString(date);
    
    setEditingPost(null);
    setFormMode("EDIT");
    setFormTitle("");
    setFormDescription("");
    setFormScheduledDate(dateStr);
    setFormScheduledTime("12:00");
    setFormPlatforms(["INSTAGRAM"]);
    setFormBrands(selectedBrand === "ALL" ? ["PARADISE"] : [selectedBrand]);
    setFormStatus("DRAFT");
    setFormCoverUrl("");
    setFormVideoUrl("");
    setFormNotes("");
    setFormError("");
    setFormSuccess("");
    setIsFormOpen(true);
  }

  // Open the editor directly for an existing post
  function openEdit(post: SocialPost) {
    const postDate = new Date(post.scheduled_at);
    const dateStr = new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/Rome"}).format(postDate);
    const timeStr = new Intl.DateTimeFormat("it-IT", {timeZone:"Europe/Rome",hour:"2-digit",minute:"2-digit"}).format(postDate);

    setEditingPost(post);
    setFormMode("EDIT");
    setFormTitle(post.title);
    setFormDescription(post.description || "");
    setFormScheduledDate(dateStr);
    setFormScheduledTime(timeStr);
    setFormPlatforms(post.platform ? post.platform.split(",") : ["INSTAGRAM"]);
    setFormBrands(post.brand ? post.brand.split(",") : ["PARADISE"]);
    setFormStatus(post.status);
    setFormCoverUrl(post.cover_url || "");
    setFormVideoUrl(post.video_url || "");
    setFormNotes(post.notes || "");
    setFormError("");
    setFormSuccess("");
    setIsFormOpen(true);

    // Fetch comments for this post
    fetchComments(post.id);
  }

  // Cover image file upload handler
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setFormError("");
    setFormSuccess("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/social-calendar/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Impossibile caricare l'immagine.");
      }

      setFormCoverUrl(data.coverUrl);
      setFormSuccess("Copertina salvata su Google Drive.");
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setUploading(false);
    }
  }

  // Submit form (Create / Update)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle || !formScheduledDate || formPlatforms.length === 0) {
      setFormError("Titolo, data e almeno una piattaforma sono obbligatori.");
      return;
    }
    if (formBrands.length === 0) {
      setFormError("Seleziona almeno un brand.");
      return;
    }

    setUploading(true);
    setFormError("");
    setFormSuccess("");

    // Combine date and time
    const dateTimeStr = `${formScheduledDate}T${formScheduledTime}:00`;
    const scheduledInstant = parseSocialSchedule(dateTimeStr);
    const scheduleError = validateSocialSchedule(formStatus, scheduledInstant);
    if (scheduleError) { setFormError(scheduleError); setUploading(false); return; }
    const payload = {
      id: editingPost?.id,
      title: formTitle,
      description: formDescription,
      scheduledAt: scheduledInstant!.toISOString(),
      platform: formPlatforms.join(","),
      status: formStatus,
      coverUrl: formCoverUrl,
      videoUrl: formVideoUrl,
      notes: formNotes,
      brand: formBrands.join(","),
    };

    const method = editingPost ? "PUT" : "POST";

    try {
      const response = await fetch("/api/social-calendar", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Errore nel salvataggio del post.");
      }

      if (editingPost) {
        // Update state
        setPosts((prev) => prev.map((p) => (p.id === result.id ? result : p)));
      } else {
        // Add to state
        setPosts((prev) => [...prev, result]);
      }

      setFormSuccess("Salvato con successo!");
      setTimeout(() => {
        setIsFormOpen(false);
      }, 800);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setUploading(false);
    }
  }

  // Delete post
  async function handleDelete(id: string) {
    if (!confirm("Sei sicuro di voler eliminare questo post dalla programmazione?")) return;

    setUploading(true);
    setFormError("");

    try {
      const response = await fetch(`/api/social-calendar?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Errore durante l'eliminazione.");
      }

      setPosts((prev) => prev.filter((p) => p.id !== id));
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={cn(styles.page, isFormOpen && styles.editingPage)}>
      {!isFormOpen && <>
      <div className={styles.channels} role="group" aria-label="Filtra per canale">
        <button type="button" aria-pressed={selectedPlatform === "ALL"} onClick={() => setSelectedPlatform("ALL")} className={cn(styles.channel, selectedPlatform === "ALL" && styles.selectedChannel)}><span className={styles.allIcon}><Layers size={20} /></span><span>Tutti i canali</span></button>
        {PLATFORMS.map(platform => <button key={platform.id} type="button" aria-pressed={selectedPlatform === platform.id} onClick={() => setSelectedPlatform(selectedPlatform === platform.id ? "ALL" : platform.id)} className={cn(styles.channel, selectedPlatform === platform.id && styles.selectedChannel)}><span className={cn(styles.channelIcon, "bg-gradient-to-br", platform.color)}>{platform.id === "INSTAGRAM" ? <Instagram size={23} /> : platform.id === "FACEBOOK" ? <b>f</b> : platform.id === "YOUTUBE" ? <Video size={23} /> : platform.id === "TIKTOK" ? <b>♪</b> : <Layers size={21} />}</span><span>{platform.name}</span></button>)}
        <button type="button" className={styles.create} onClick={() => openCreateForDate(new Date())}><Plus size={18} /> Crea contenuto</button>
      </div>
      <div className={styles.toolbar}>
        <label className={styles.search}><Search size={16}/><input aria-label="Cerca contenuti" placeholder="Cerca un contenuto…" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} /></label>
        <select aria-label="Stato del contenuto" value={selectedStatus} onChange={event => setSelectedStatus(event.target.value)}><option value="ALL">Tutti gli stati</option>{STATUSES.map(status => <option key={status.id} value={status.id}>{status.name}</option>)}</select>
        <select aria-label="Autore del contenuto" value={selectedAuthor} onChange={event => setSelectedAuthor(event.target.value)}><option value="ALL">Tutti i membri</option>{Array.from(new Map(posts.map(post => [post.created_by_id, post.created_by])).entries()).map(([id, author]) => <option key={id} value={id}>{author?.name || "Collaboratore"}</option>)}</select>
        <div className={styles.navigation}><button onClick={prevMonth} aria-label="Mese precedente"><ChevronLeft size={17}/></button><span><CalendarIcon size={16}/>{new Intl.DateTimeFormat("it-IT", {month:"long",year:"numeric"}).format(currentDate)}</span><button onClick={nextMonth} aria-label="Mese successivo"><ChevronRight size={17}/></button><button onClick={setToday}>Oggi</button></div>
        <div className={styles.viewSwitch} role="group" aria-label="Vista calendario"><button aria-pressed={viewMode === "MONTH"} onClick={() => setViewMode("MONTH")}>Mese</button><button aria-pressed={viewMode === "LIST"} onClick={() => setViewMode("LIST")}>Elenco</button></div>
      </div>
      <div className={styles.brands} role="group" aria-label="Filtra per brand">{[{id:"ALL",name:"Tutti i brand"},{id:"PARADISE",name:"Paradise"},{id:"FRANCESCA",name:"Francesca"}].map(brand => <button key={brand.id} aria-pressed={selectedBrand === brand.id} onClick={() => setSelectedBrand(brand.id)}>{brand.name}</button>)}<span>{filteredPosts.length} contenuti</span></div>

      {/* Main View Render */}
      {viewMode === "MONTH" ? (
        <Card className={styles.calendar}>
          {/* Weekdays header */}
          <div className="grid grid-cols-7 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] text-center">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-3 text-[11px] font-extrabold uppercase tracking-wider text-black/50 dark:text-white/40">
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className={styles.days}>
            {calendarDays.map((cell) => {
              const dateStr = getLocalDateString(cell.date);
              const dayPosts = postsByDate[dateStr] || [];
              const isToday = getLocalDateString(new Date()) === dateStr;

              return (
                <div 
                  key={cell.key}
                  data-today={isToday}
                  aria-current={isToday ? "date" : undefined}
                  data-outside={!cell.isCurrentMonth}
                  onClick={() => {
                    if (dayPosts.length > 0) {
                      openEdit(dayPosts[0]);
                    } else {
                      openCreateForDate(cell.date);
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={() => setDraggedOverDate(dateStr)}
                  onDragLeave={() => {
                    setDraggedOverDate((current) => current === dateStr ? null : current);
                  }}
                  onDrop={(e) => handleDrop(e, cell.date)}
                  className={cn(
                    styles.day, "relative group p-2 flex flex-col gap-1.5 transition-all duration-200 cursor-pointer",
                    cell.isCurrentMonth ? "bg-white dark:bg-neutral-950" : "bg-black/[0.02] text-black/30 dark:bg-white/[0.02] dark:text-white/30",
                    isToday && "bg-paradise-nude/40 dark:bg-[#C66170]/10",
                    draggedOverDate === dateStr ? "bg-[#C66170]/10 border-2 border-dashed border-[#C66170]" : "hover:bg-paradise-nude/20 dark:hover:bg-white/5"
                  )}
                >
                  {/* Day Number */}
                  <div className={cn("flex items-center justify-between", isToday && styles.todayHeader)}>
                    <span className={cn(
                       "text-xs font-bold leading-none size-6 rounded-full flex items-center justify-center transition-colors",
                      isToday ? "bg-[#C66170] text-white font-extrabold" : "text-black/60 dark:text-white/60",
                      !cell.isCurrentMonth && "opacity-40"
                    )}>
                      {cell.date.getDate()}
                    </span>
                    
                    {isToday && <span className={styles.todayLabel}>Oggi</span>}
                    {/* Hover add shortcut */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        openCreateForDate(cell.date);
                      }}
                      className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition duration-150 p-0.5 rounded-full text-black/35 hover:text-[#C66170] dark:text-white/35 dark:hover:text-[#C66170] hover:bg-black/5 dark:hover:bg-white/5"
                      title="Pianifica video per questo giorno"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>

                  {/* Scheduled Posts Lists */}
                  <div className="flex-1 space-y-2">
                    {dayPosts.map((post) => {
                      const postPlatforms = getPlatformsList(post.platform);
                      const mainPlat = postPlatforms[0] || PLATFORMS[0];
                      
                      return (
                        <button type="button" key={post.id} data-status={post.status} onClick={event => { event.stopPropagation(); openEdit(post); }} draggable onDragStart={event => handleDragStart(event, post.id)} className={styles.postCard} title={`${post.title} · ${postPlatforms.map(platform => platform.name).join(" / ")}`}>
                          <span className={styles.postMeta}><span className={mainPlat.text}>{mainPlat.id === "INSTAGRAM" ? <Instagram size={13}/> : <Video size={13}/>}</span><span>{post.brand?.split(",").map(brand => brand === "FRANCESCA" ? "Francesca" : "Paradise").join(" · ") || "Paradise"}</span></span>
                          <time className={styles.postTime} dateTime={post.scheduled_at}><Clock size={12}/>{new Intl.DateTimeFormat("it-IT", {timeZone:"Europe/Rome",hour:"2-digit",minute:"2-digit"}).format(new Date(post.scheduled_at))}</time>
                          {post.cover_url ? <img src={post.cover_url} alt="" loading="lazy" className={styles.postImage}/> : <span className={styles.mediaPlaceholder}><Video size={23}/></span>}
                          <span className={styles.postTitle}>{post.title}</span>
                          <span className={cn(styles.postStatus, STATUSES.find(status => status.id === post.status)?.color)}>{STATUSES.find(status => status.id === post.status)?.name || post.status}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <div className={styles.listTableWrap}>
          {listFeedback && <p className={styles.listFeedback} role="status">{listFeedback}</p>}
          <table className={styles.listTable}>
            <caption className="sr-only">Contenuti social · vista elenco</caption>
            <thead><tr><th scope="col">Stato</th><th scope="col">Contenuto</th><th scope="col">Data e ora</th><th scope="col">Canali</th><th scope="col">Brand</th><th scope="col">Creato da</th></tr></thead>
            <tbody>
              {filteredPosts.map(post => {
                return <tr key={post.id}>
                  <td><select className={styles.listStatus} data-status={post.status} aria-label={`Stato di ${post.title}`} value={scheduleRow === post.id ? "PLANNED" : post.status} disabled={statusSaving !== null} onChange={event => {
                    if (event.target.value === "PLANNED") {
                      setScheduleRow(post.id);
                      setListSchedule(new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Rome"}).format(new Date(post.scheduled_at)) + "T" + new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",hour:"2-digit",minute:"2-digit"}).format(new Date(post.scheduled_at)));
                      setListFeedback("");
                    } else { setScheduleRow(null); void updateListStatus(post,event.target.value); }
                  }}>{STATUSES.map(status => <option key={status.id} value={status.id}>{status.name}</option>)}</select>
                  {scheduleRow === post.id && <div className={styles.inlineSchedule}>
                    <label>Data e ora<input type="datetime-local" aria-label={`Programma ${post.title}`} value={listSchedule} onChange={event => setListSchedule(event.target.value)} disabled={statusSaving !== null}/></label>
                    <button type="button" disabled={statusSaving !== null} onClick={() => {
                      const date = parseSocialSchedule(listSchedule);
                      const error = validateSocialSchedule("PLANNED",date);
                      if(error) {setListFeedback(error);return;}
                      void updateListStatus(post,"PLANNED",date!.toISOString());
                    }}>Salva</button><button type="button" disabled={statusSaving !== null} onClick={() => setScheduleRow(null)}>Annulla</button>
                  </div>}
                  </td>
                  <td><button type="button" className={styles.listTitle} onClick={() => openEdit(post)}>
                    {post.cover_url ? <img src={post.cover_url} alt=""/> : <FileText size={16}/>}
                    <span>{post.title}</span><small>Apri ↗</small>
                  </button></td>
                  <td className={styles.listDate}>{new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",day:"2-digit",month:"short",year:"numeric"}).format(new Date(post.scheduled_at))}<span>{new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",hour:"2-digit",minute:"2-digit"}).format(new Date(post.scheduled_at))}</span></td>
                  <td><div className={styles.listTags}>{getPlatformsList(post.platform).map(platform => <span key={platform.id} className={cn(platform.bgLight,platform.text)}>{platform.name}</span>)}</div></td>
                  <td><div className={styles.listTags}>{(post.brand || "PARADISE").split(",").map(brand => <span key={brand}>{brand === "FRANCESCA" ? "Francesca" : "Paradise"}</span>)}</div></td>
                  <td><div className={styles.listAuthor}><span className={styles.listAvatar}>{post.created_by.name.slice(0,1)}{post.created_by.photo_url && <img src={resolveDrivePhotoUrl(post.created_by.photo_url)} alt="" onError={event => { event.currentTarget.style.display = "none"; }}/>}</span>{post.created_by.name}</div></td>
                </tr>;
              })}
              {filteredPosts.length === 0 && <tr><td colSpan={6} className={styles.listEmpty}>Nessun contenuto con i filtri attuali.</td></tr>}
            </tbody>
          </table>
          <div className={styles.listCount}>{filteredPosts.length} contenuti</div>
        </div>
      )}

      </>}
      {/* Full-page content editor */}
      {isFormOpen && (
        <div className={styles.editorPage}>
          <button type="button" className={styles.backToCalendar} onClick={() => setIsFormOpen(false)}><ChevronLeft size={17}/> Torna al calendario</button>
          <div ref={editorRef} aria-labelledby="social-editor-title" className={styles.editor}>
            <div className={styles.editorContent}>
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-4 mb-5">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-2xl bg-[#C66170]/10 text-[#C66170]">
                    <SlidersHorizontal className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-black dark:text-white uppercase tracking-wider">
                      {formMode === "VIEW" ? "Dettagli contenuto" : editingPost ? "Modifica contenuto" : "Nuovo contenuto"}
                    </h3>
                    <p className="text-[10px] text-black/45 dark:text-white/40">
                      {formMode === "VIEW" ? "Visualizza le informazioni del post programmato." : "Inserisci i dettagli per la pubblicazione sui social."}
                    </p>
                  </div>
                </div>

              </div>

              {/* Status Banner inside main body */}
              {formError && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-bold text-rose-700 dark:text-rose-400 mb-4 animate-in fade-in">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-4 animate-in fade-in">
                  {formSuccess}
                </div>
              )}

              {formMode === "VIEW" && editingPost ? (
                /* VIEW MODE DETAILS */
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Cover image banner */}
                  {editingPost.cover_url ? (
                    <div className="relative w-full h-52 rounded-2xl overflow-hidden border border-black/5 dark:border-white/10 shadow-sm bg-neutral-100 dark:bg-neutral-900">
                      <img src={editingPost.cover_url} alt="" className="w-full h-full object-cover select-none pointer-events-none" />
                    </div>
                  ) : (
                    <div className="w-full h-32 rounded-2xl border border-dashed border-black/10 dark:border-white/10 flex flex-col items-center justify-center bg-black/[0.01] dark:bg-white/[0.01] text-black/30 dark:text-white/30">
                      <Video className="size-8 mb-1" />
                      <span className="text-[10px] font-bold">Nessuna copertina caricata</span>
                    </div>
                  )}

                  {/* Badges platform & status */}
                  <div className="flex flex-wrap gap-2">
                    {editingPost.brand ? editingPost.brand.split(",").map((brand) => (
                      <span key={brand} className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border shadow-2xs bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
                        Brand: {brand === "FRANCESCA" ? "Francesca" : "Paradise"}
                      </span>
                    )) : (
                      <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border shadow-2xs bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
                        Brand: Paradise
                      </span>
                    )}

                    {getPlatformsList(editingPost.platform).map((plat) => (
                      <span key={plat.id} className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border shadow-2xs",
                        plat.bgLight,
                        plat.text
                      )}>
                        {plat.name}
                      </span>
                    ))}

                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border shadow-2xs",
                      STATUSES.find((s) => s.id === editingPost.status)?.color
                    )}>
                      {STATUSES.find((s) => s.id === editingPost.status)?.name}
                    </span>
                  </div>

                  {/* Post Title */}
                  <div className="space-y-1">
                    <h4 className="text-xl font-extrabold text-black dark:text-white leading-snug">
                      {editingPost.title}
                    </h4>
                    <p className="text-[10px] text-black/45 dark:text-white/40 flex items-center gap-1">
                      <Clock className="size-3.5" />
                      Programmato per il {new Date(editingPost.scheduled_at).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })} alle {new Date(editingPost.scheduled_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>

                  {/* Description / Caption */}
                  {editingPost.description ? (
                    <div className="space-y-1 bg-black/[0.01] dark:bg-white/[0.01] border border-black/5 dark:border-white/5 p-3.5 rounded-2xl">
                      <span className="text-[10px] font-extrabold text-black/40 dark:text-white/40 uppercase tracking-wider block">Copy del post</span>
                      <p className="text-xs text-black/80 dark:text-white/80 whitespace-pre-wrap leading-relaxed font-semibold">
                        {editingPost.description}
                      </p>
                    </div>
                  ) : (
                    <div className="text-xs text-black/40 dark:text-white/40 italic pl-1">
                      Nessun copy inserito. Premi Modifica per aggiungerlo.
                    </div>
                  )}

                  {/* Video Link */}
                  {editingPost.video_url && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-extrabold text-black/40 dark:text-white/40 uppercase tracking-wider pl-1 block">Link Risorsa Video</span>
                      <a 
                        href={editingPost.video_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-[#C66170]/10 border border-[#C66170]/20 text-[#C66170] px-4 py-2 text-xs font-bold transition hover:bg-[#C66170]/15 w-full shadow-2xs"
                      >
                        Apri Risorsa Video <ExternalLink className="size-3.5" />
                      </a>
                    </div>
                  )}

                  {/* Internal Notes */}
                  {editingPost.notes && (
                    <div className="space-y-1 border border-amber-500/10 bg-amber-500/[0.02] p-3.5 rounded-2xl">
                      <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Note operative interne</span>
                      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-semibold">
                        {editingPost.notes}
                      </p>
                    </div>
                  )}

                  {/* Comments Section */}
                  <div className="border-t border-black/5 dark:border-white/5 pt-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-extrabold text-black dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <MessageSquare className="size-4 text-[#C66170]" />
                        Commenti ({comments.length})
                      </h5>
                    </div>

                    {/* Comments list */}
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 luxury-scroll">
                      {loadingComments ? (
                        <p className="text-[10px] text-black/40 dark:text-white/40 italic">Caricamento commenti...</p>
                      ) : comments.length === 0 ? (
                        <p className="text-[10px] text-black/40 dark:text-white/40 italic">Nessun commento presente. Aggiungi il primo!</p>
                      ) : (
                        comments.map((comment) => (
                          <div key={comment.id} className="rounded-xl border border-black/5 bg-[#FAF7F9]/30 dark:bg-white/5 p-3 hover:bg-[#FAF7F9]/50 dark:hover:bg-white/10 transition animate-in fade-in duration-200">
                            <div className="flex items-start gap-2.5">
                              {/* Avatar */}
                              <div className="size-7 rounded-full overflow-hidden bg-neutral-200 border border-black/5 shrink-0">
                                {comment.user.photo_url ? (
                                  <img src={resolveDrivePhotoUrl(comment.user.photo_url)} alt="" className="size-full object-cover" />
                                ) : (
                                  <div className="size-full flex items-center justify-center text-[9px] font-bold text-neutral-600 uppercase">
                                    {comment.user.name.slice(0, 1)}
                                  </div>
                                )}
                              </div>
                              {/* Content */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <span className="text-[11px] font-bold text-black/80 dark:text-white/95">{comment.user.name}</span>
                                    {comment.user.mansione && (
                                      <span className="text-[8px] font-semibold text-black/40 dark:text-white/40 ml-1.5 border border-black/10 dark:border-white/10 px-1 rounded-sm">
                                        {comment.user.mansione}
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Delete option */}
                                  {(comment.user.id === currentUserId) && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteComment(comment.id)}
                                      className="text-black/35 hover:text-rose-500 dark:text-white/35 dark:hover:text-rose-400 transition"
                                      title="Elimina commento"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  )}
                                </div>
                                <span className="text-[9px] text-black/40 dark:text-white/40 block mt-0.5">
                                  {new Date(comment.created_at).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                </span>
                                <p className="mt-1.5 text-[11px] leading-relaxed text-black/70 dark:text-white/80 whitespace-pre-wrap font-semibold">
                                  {comment.message}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* New comment form */}
                    <form onSubmit={handleAddComment} className="flex gap-2 items-end pt-1">
                      <textarea
                        value={newCommentMessage}
                        onChange={(e) => setNewCommentMessage(e.target.value)}
                        placeholder="Scrivi un commento..."
                        rows={1}
                        className="flex-1 min-h-[38px] max-h-[80px] rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[#C66170]/30 transition resize-none luxury-scroll"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment(e);
                          }
                        }}
                      />
                      <button
                        type="submit"
                        disabled={submittingComment || !newCommentMessage.trim()}
                        className="inline-flex size-[38px] items-center justify-center rounded-xl bg-[#C66170] text-white hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-40 disabled:scale-100 shrink-0 shadow-sm"
                      >
                        <Send className="size-3.5" />
                      </button>
                    </form>
                  </div>

                  {/* Creator details */}
                  <div className="border-t border-black/5 dark:border-white/5 pt-4 flex items-center justify-between">
                    <span className="text-[10px] text-black/40 dark:text-white/40 font-bold uppercase tracking-wider">Creato da</span>
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-full overflow-hidden bg-neutral-200 border border-black/5">
                        {editingPost.created_by.photo_url ? (
                          <img src={resolveDrivePhotoUrl(editingPost.created_by.photo_url)} alt="" className="size-full object-cover" />
                        ) : (
                          <div className="size-full flex items-center justify-center text-[9px] font-bold text-neutral-600 uppercase">
                            {editingPost.created_by.name.slice(0, 1)}
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-bold text-black/75 dark:text-white/75">{editingPost.created_by.name}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* EDIT MODE FORM */
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Cover Upload (Google Drive) */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-black/50 dark:text-white/40 uppercase tracking-wider pl-1">Foto del contenuto</span>
                    <div className="flex gap-4 items-center rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-3 bg-black/[0.01] dark:bg-white/[0.01]">

                      {/* Preview box */}
                      <div className={styles.coverPhoto}>
                        {formCoverUrl ? (
                          <img src={formCoverUrl} alt="Foto del contenuto" className="size-full object-contain" />
                        ) : (
                          <Video className="size-5 text-black/20 dark:text-white/20" />
                        )}
                      </div>

                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          id="social-cover-input"
                          className="hidden"
                          onChange={handleFileUpload}
                          disabled={uploading}
                        />
                        <label
                          htmlFor="social-cover-input"
                          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-white dark:bg-white/10 px-3 py-1.5 text-[10px] font-extrabold shadow-sm ring-1 ring-black/5 dark:ring-white/10 hover:bg-neutral-50 dark:hover:bg-white/15 cursor-pointer active:scale-95 transition"
                        >
                          <Upload className="size-3.5" /> {uploading ? "Caricamento..." : formCoverUrl ? "Sostituisci foto" : "Carica su Google Drive"}
                        </label>
                        <p className="text-[9px] text-black/40 dark:text-white/40 mt-1">JPG, PNG, WebP o GIF fino a 10 MB. Salvata in Google Drive · Social Calendar.</p>
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-black/50 dark:text-white/40 uppercase tracking-wider pl-1">Titolo Video / Post</span>
                    <Field
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="Esempio: Tutorial Makeup Sposa 2026"
                      required
                    />
                  </div>

                  <div className={styles.copyField}>
                    <div className={styles.copyHeading}><label htmlFor="social-post-copy">Copy del post</label><span>{formDescription.length.toLocaleString("it-IT")} caratteri</span></div>
                    <p id="social-copy-help">Scrivi il testo da pubblicare, con hashtag, emoji e invito all’azione.</p>
                    <textarea id="social-post-copy" aria-describedby="social-copy-help" value={formDescription} onChange={event => setFormDescription(event.target.value)} placeholder="Scrivi qui il copy del tuo post…" rows={6} />
                  </div>

                  {/* Brand selector */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-black/50 dark:text-white/40 uppercase tracking-wider pl-1">Profilo / Brand (Seleziona multipli)</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (formBrands.includes("PARADISE")) {
                            if (formBrands.length > 1) {
                              setFormBrands(formBrands.filter(b => b !== "PARADISE"));
                            }
                          } else {
                            setFormBrands([...formBrands, "PARADISE"]);
                          }
                        }}
                        className={cn(
                          "py-2 rounded-xl border text-center text-xs font-extrabold uppercase transition-all",
                          formBrands.includes("PARADISE")
                            ? "border-[#C66170] bg-[#C66170]/10 text-[#C66170]"
                            : "border-black/5 bg-black/5 text-black/60 dark:border-white/5 dark:bg-white/5 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/10"
                        )}
                      >
                        Paradise Beauty
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (formBrands.includes("FRANCESCA")) {
                            if (formBrands.length > 1) {
                              setFormBrands(formBrands.filter(b => b !== "FRANCESCA"));
                            }
                          } else {
                            setFormBrands([...formBrands, "FRANCESCA"]);
                          }
                        }}
                        className={cn(
                          "py-2 rounded-xl border text-center text-xs font-extrabold uppercase transition-all",
                          formBrands.includes("FRANCESCA")
                            ? "border-[#C66170] bg-[#C66170]/10 text-[#C66170]"
                            : "border-black/5 bg-black/5 text-black/60 dark:border-white/5 dark:bg-white/5 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/10"
                        )}
                      >
                        Francesca
                      </button>
                    </div>
                  </div>

                  {/* Platform Selector Grid (Multi-select) */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-black/50 dark:text-white/40 uppercase tracking-wider pl-1">Canali / Piattaforme (Seleziona multiple)</span>
                    <div className="grid grid-cols-3 gap-2">
                      {PLATFORMS.map((plat) => {
                        const isSelected = formPlatforms.includes(plat.id);
                        return (
                          <button
                            key={plat.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                if (formPlatforms.length > 1) {
                                  setFormPlatforms(formPlatforms.filter((p) => p !== plat.id));
                                }
                              } else {
                                setFormPlatforms([...formPlatforms, plat.id]);
                              }
                            }}
                            className={cn(
                              "flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-center",
                              isSelected
                                ? "border-[#C66170] bg-[#C66170]/10 text-[#C66170] font-extrabold"
                                : "border-black/5 bg-black/5 text-black/60 dark:border-white/5 dark:bg-white/5 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/10"
                            )}
                          >
                            <span className="text-xs font-extrabold">{plat.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Status selector */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-black/50 dark:text-white/40 uppercase tracking-wider pl-1">Stato Programmazione</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {STATUSES.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          aria-pressed={formStatus === st.id}
                          onClick={() => {
                            setFormStatus(st.id);
                            if (st.id === "PLANNED") requestAnimationFrame(() => {
                              const field = document.getElementById("social-scheduled-date");
                              field?.scrollIntoView({block:"nearest",behavior:"smooth"});
                              field?.focus({preventScroll:true});
                            });
                          }}
                          className={cn(
                            "py-2 rounded-xl border text-center text-xs font-extrabold uppercase transition-all",
                            formStatus === st.id
                              ? "border-[#C66170] bg-[#C66170]/10 text-[#C66170]"
                              : "border-black/5 bg-black/5 text-black/60 dark:border-white/5 dark:bg-white/5 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/10"
                          )}
                        >
                          {st.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {formStatus === "PLANNED" && <p className={styles.scheduleHint}>Scegli data e ora (Italia). Alla scadenza il contenuto passerà automaticamente a “Pubblicato” nel calendario. Non viene inviato ai social.</p>}
                  {/* Date & Time Picker */}
                  <div className={cn("grid grid-cols-2 gap-4", formStatus === "PLANNED" && styles.schedulingFields)}>
                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold text-black/50 dark:text-white/40 uppercase tracking-wider pl-1">{formStatus === "PLANNED" ? "Data programmata" : "Data nel calendario"}</span>
                      <Field
                        id="social-scheduled-date"
                        aria-label="Data del contenuto"
                        type="date"
                        value={formScheduledDate}
                        onChange={(e) => setFormScheduledDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold text-black/50 dark:text-white/40 uppercase tracking-wider pl-1">Orario</span>
                      <Field
                        aria-label="Ora del contenuto"
                        type="time"
                        value={formScheduledTime}
                        onChange={(e) => setFormScheduledTime(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Video Link */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-black/50 dark:text-white/40 uppercase tracking-wider pl-1">Link Video (Drive / Canva / YouTube)</span>
                    <Field
                      value={formVideoUrl}
                      onChange={(e) => setFormVideoUrl(e.target.value)}
                      placeholder="Incolla il link del video per la pubblicazione"
                    />
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-black/50 dark:text-white/40 uppercase tracking-wider pl-1">Note Interne</span>
                    <textarea
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder="Note per il team o commenti operativi..."
                      rows={2}
                      className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#C66170]/30 transition"
                    />
                  </div>
                </form>
              )}
            </div>

            <aside className={styles.preview} aria-label="Anteprima del contenuto">
              <div className={styles.previewHeading}><span>Anteprima del post</span><span>{formPlatforms.map(platform => PLATFORMS.find(item => item.id === platform)?.name).join(" · ")}</span></div>
              <div className={styles.phoneFrame}>
                <div className={styles.phoneScreen}>
                  <div className={styles.phoneStatus} aria-hidden="true"><span>9:41</span><i/><span><Signal size={13}/><Wifi size={13}/><BatteryFull size={17}/></span></div>
                  <div className={styles.phoneAppBar}><strong>{PLATFORMS.find(platform => platform.id === formPlatforms[0])?.name || "Social"}</strong><span aria-hidden="true"><Heart size={20}/><Send size={20}/></span></div>
                  <article className={styles.phonePost}>
                    <header><span className={styles.previewAvatar}>{formBrands.includes("FRANCESCA") ? "F" : "P"}</span><div><strong>{formBrands.map(brand => brand === "FRANCESCA" ? "Francesca" : "Paradise Beauty").join(" · ")}</strong><small>Post</small></div><MoreHorizontal size={20} aria-hidden="true"/></header>
                    {formCoverUrl ? <img className={styles.phonePhoto} src={formCoverUrl} alt="Anteprima della foto pubblicata"/> : <div className={styles.phonePlaceholder}><Upload size={30}/><span>La tua foto apparirà qui</span></div>}
                    <div className={styles.phoneActions} aria-hidden="true"><Heart/><MessageSquare/><Send/><Bookmark/></div>
                    <div className={styles.phoneCopy}><strong>{formTitle || "Il titolo del tuo contenuto"}</strong><p>{formDescription || "Il copy del post apparirà qui mentre scrivi."}</p><small>{formScheduledDate ? new Intl.DateTimeFormat("it-IT",{day:"numeric",month:"long"}).format(new Date(`${formScheduledDate}T12:00:00`)) : "Data da definire"}</small></div>
                  </article>
                  <div className={styles.phoneNavigation} aria-hidden="true"><Home size={21}/><Search size={21}/><Plus size={23}/><Video size={21}/><span>{formBrands.includes("FRANCESCA") ? "F" : "P"}</span></div>
                  <div className={styles.phoneHome} aria-hidden="true"/>
                </div>
              </div>
              <p className={styles.previewNote}>Anteprima indicativa. Il calendario organizza i contenuti: il salvataggio non li pubblica automaticamente sui social.</p>
            </aside>

            {/* Action buttons footer */}
            <div className={styles.editorFooter}>
              {formMode === "VIEW" && editingPost ? (
                <>
                  <div />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="inline-flex min-h-11 items-center justify-center rounded-2xl px-5 py-2.5 text-xs font-extrabold bg-neutral-100 dark:bg-neutral-800 text-black/70 dark:text-white/70 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition"
                    >
                      Torna al calendario
                    </button>
                    <Button
                      onClick={() => setFormMode("EDIT")}
                      className="min-h-11 font-extrabold shadow-sm bg-[#C66170] hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      Modifica
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {editingPost ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingPost.id)}
                      disabled={uploading}
                      className="p-3 rounded-2xl text-rose-500 hover:bg-rose-500/10 active:scale-95 transition"
                      title="Elimina Post"
                    >
                      <Trash2 className="size-5" />
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="inline-flex min-h-11 items-center justify-center rounded-2xl px-5 py-2.5 text-xs font-extrabold bg-neutral-100 dark:bg-neutral-800 text-black/70 dark:text-white/70 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition"
                    >
                      {editingPost ? "Annulla" : "Torna al calendario"}
                    </button>
                    <Button
                      onClick={handleSubmit}
                      disabled={uploading}
                      className="min-h-11"
                    >
                      {uploading ? "Salvataggio..." : formStatus === "PLANNED" ? "Salva programmazione" : "Salva contenuto"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
