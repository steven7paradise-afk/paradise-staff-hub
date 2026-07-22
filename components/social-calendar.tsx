"use client";

import React, { useState, useMemo } from "react";
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
  Send
} from "lucide-react";
import { Button, Card, Field } from "@/components/ui";
import { resolveDrivePhotoUrl } from "@/lib/photo-url";
import { cn } from "@/lib/utils";

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
  { id: "DRAFT", name: "Bozza", color: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/30" },
  { id: "PLANNED", name: "Pianificato", color: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/30" },
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
  
  // Calendar Navigation State
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"MONTH" | "LIST">("MONTH");
  
  // Modal / Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [formMode, setFormMode] = useState<"VIEW" | "EDIT">("VIEW");
  
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

    const originalDate = new Date(post.scheduled_at);
    const targetWithTime = new Date(targetDate);
    targetWithTime.setHours(originalDate.getHours());
    targetWithTime.setMinutes(originalDate.getMinutes());
    targetWithTime.setSeconds(0);
    targetWithTime.setMilliseconds(0);

    const newScheduledAtStr = targetWithTime.toISOString();

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
      
      return matchesSearch && matchesBrand && matchesStatus;
    });
  }, [posts, searchQuery, selectedBrand, selectedStatus]);

  // Group filtered posts by date key (YYYY-MM-DD) for Month View
  const postsByDate = useMemo(() => {
    const map: Record<string, SocialPost[]> = {};
    filteredPosts.forEach((post) => {
      const dateKey = getLocalDateString(new Date(post.scheduled_at));
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(post);
    });
    return map;
  }, [filteredPosts]);

  // Open creation modal for a specific day
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

  // Open edit modal for an existing post
  function openEdit(post: SocialPost) {
    const postDate = new Date(post.scheduled_at);
    const dateStr = getLocalDateString(postDate);
    const hours = String(postDate.getHours()).padStart(2, "0");
    const minutes = String(postDate.getMinutes()).padStart(2, "0");
    const timeStr = `${hours}:${minutes}`;

    setEditingPost(post);
    setFormMode("VIEW");
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
      setFormSuccess("Copertina caricata con successo.");
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
    const payload = {
      id: editingPost?.id,
      title: formTitle,
      description: formDescription,
      scheduledAt: dateTimeStr,
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
    <div className="space-y-6">
      {/* Calendar Header / Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white/90 dark:bg-neutral-900 border border-black/5 dark:border-white/10 p-4 rounded-3xl shadow-sm backdrop-blur-md">
        
        {/* Navigation controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-2xl bg-black/5 dark:bg-white/5 p-1 border border-black/5 dark:border-white/5">
            <button 
              onClick={prevMonth} 
              className="p-2 rounded-xl text-black/70 hover:bg-white hover:text-black hover:shadow-sm dark:text-white/70 dark:hover:bg-neutral-800 transition"
              title="Mese Precedente"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button 
              onClick={setToday}
              className="px-3 py-1 rounded-xl text-xs font-extrabold text-black/70 hover:bg-white hover:text-black hover:shadow-sm dark:text-white/70 dark:hover:bg-neutral-800 transition"
            >
              Oggi
            </button>
            <button 
              onClick={nextMonth} 
              className="p-2 rounded-xl text-black/70 hover:bg-white hover:text-black hover:shadow-sm dark:text-white/70 dark:hover:bg-neutral-800 transition"
              title="Mese Successivo"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          
          <h2 className="text-sm font-extrabold text-black/80 dark:text-white/90 uppercase tracking-wider pl-1">
            {new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(currentDate)}
          </h2>
        </div>

        {/* View Switcher & Action Button */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-2xl bg-black/5 dark:bg-white/5 p-1 border border-black/5 dark:border-white/5">
            <button 
              onClick={() => setViewMode("MONTH")}
              className={cn(
                "px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200",
                viewMode === "MONTH" ? "bg-[#C66170] text-white shadow-sm" : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
              )}
            >
              Calendario
            </button>
            <button 
              onClick={() => setViewMode("LIST")}
              className={cn(
                "px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200",
                viewMode === "LIST" ? "bg-[#C66170] text-white shadow-sm" : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
              )}
            >
              Agenda Coda
            </button>
          </div>

          <button
            onClick={() => openCreateForDate(new Date())}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-[#C66170] px-4 py-2 text-xs font-extrabold text-white shadow-[0_4px_12px_rgba(198,97,112,0.3)] transition hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="size-4" /> Pianifica Video
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="grid gap-4 md:grid-cols-[1fr_auto] bg-white/90 dark:bg-neutral-900 border border-black/5 dark:border-white/10 p-4 rounded-3xl shadow-sm backdrop-blur-md">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-black/35 dark:text-white/35" />
          <input
            type="text"
            placeholder="Cerca video per titolo, descrizione o note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 pl-10 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-[#C66170]/30 transition"
          />
        </div>

        {/* Categories */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Brand selector */}
          <div className="flex items-center gap-1 rounded-2xl bg-black/5 dark:bg-white/5 p-1 border border-black/5 dark:border-white/5">
            <button
              onClick={() => setSelectedBrand("ALL")}
              className={cn(
                "px-3 py-1 rounded-xl text-[10px] font-extrabold uppercase transition",
                selectedBrand === "ALL" ? "bg-white text-black shadow-sm dark:bg-neutral-800 dark:text-white" : "text-black/50 dark:text-white/50"
              )}
            >
              Tutti i Brand
            </button>
            <button
              onClick={() => setSelectedBrand("FRANCESCA")}
              className={cn(
                "px-3 py-1 rounded-xl text-[10px] font-extrabold uppercase transition",
                selectedBrand === "FRANCESCA" ? "bg-white text-black shadow-sm dark:bg-neutral-800 dark:text-white" : "text-black/50 dark:text-white/50"
              )}
            >
              Francesca
            </button>
            <button
              onClick={() => setSelectedBrand("PARADISE")}
              className={cn(
                "px-3 py-1 rounded-xl text-[10px] font-extrabold uppercase transition",
                selectedBrand === "PARADISE" ? "bg-white text-black shadow-sm dark:bg-neutral-800 dark:text-white" : "text-black/50 dark:text-white/50"
              )}
            >
              Paradise
            </button>
          </div>

          {/* Status selector */}
          <div className="flex items-center gap-1 rounded-2xl bg-black/5 dark:bg-white/5 p-1 border border-black/5 dark:border-white/5">
            <button
              onClick={() => setSelectedStatus("ALL")}
              className={cn(
                "px-3 py-1 rounded-xl text-[10px] font-extrabold uppercase transition",
                selectedStatus === "ALL" ? "bg-white text-black shadow-sm dark:bg-neutral-800 dark:text-white" : "text-black/50 dark:text-white/50"
              )}
            >
              Stati
            </button>
            {STATUSES.map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStatus(st.id)}
                className={cn(
                  "px-3 py-1 rounded-xl text-[10px] font-extrabold uppercase transition",
                  selectedStatus === st.id ? "bg-white text-black shadow-sm dark:bg-neutral-800 dark:text-white" : "text-black/50 dark:text-white/50"
                )}
              >
                {st.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main View Render */}
      {viewMode === "MONTH" ? (
        <Card className="border border-black/5 dark:border-white/10 bg-white/90 dark:bg-neutral-900 shadow-soft overflow-hidden rounded-[30px]">
          {/* Weekdays header */}
          <div className="grid grid-cols-7 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] text-center">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-3 text-[11px] font-extrabold uppercase tracking-wider text-black/50 dark:text-white/40">
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 grid-rows-6 auto-rows-fr divide-x divide-y divide-black/5 dark:divide-white/5 min-h-[560px]">
            {calendarDays.map((cell) => {
              const dateStr = getLocalDateString(cell.date);
              const dayPosts = postsByDate[dateStr] || [];
              const isToday = getLocalDateString(new Date()) === dateStr;

              return (
                <div 
                  key={cell.key}
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
                    "relative group p-2 min-h-[90px] flex flex-col gap-1.5 transition-all duration-200 cursor-pointer",
                    cell.isCurrentMonth ? "bg-white dark:bg-neutral-950" : "bg-black/[0.02] text-black/30 dark:bg-white/[0.02] dark:text-white/30",
                    isToday && "bg-paradise-nude/40 dark:bg-[#C66170]/10",
                    draggedOverDate === dateStr ? "bg-[#C66170]/10 border-2 border-dashed border-[#C66170]" : "hover:bg-paradise-nude/20 dark:hover:bg-white/5"
                  )}
                >
                  {/* Day Number */}
                  <div className="flex items-center justify-between">
                    <span className={cn(
                       "text-xs font-bold leading-none size-6 rounded-full flex items-center justify-center transition-colors",
                      isToday ? "bg-[#C66170] text-white font-extrabold" : "text-black/60 dark:text-white/60",
                      !cell.isCurrentMonth && "opacity-40"
                    )}>
                      {cell.date.getDate()}
                    </span>
                    
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
                  <div className="flex-1 space-y-1 overflow-y-auto max-h-[120px] luxury-scroll">
                    {dayPosts.map((post) => {
                      const postPlatforms = getPlatformsList(post.platform);
                      const mainPlat = postPlatforms[0] || PLATFORMS[0];
                      
                      return (
                        <div
                          key={post.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(post);
                          }}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, post.id)}
                          className={cn(
                            "flex items-center gap-1.5 p-1 rounded-lg border border-black/5 dark:border-white/5 text-[9px] font-bold transition duration-200 hover:-translate-y-0.5 hover:shadow-xs cursor-grab active:cursor-grabbing",
                            mainPlat.bgLight,
                            mainPlat.text
                          )}
                          title={`${post.title} (${postPlatforms.map(p => p.name).join(" / ")})`}
                        >
                          {/* Optional tiny thumbnail preview */}
                          {post.cover_url ? (
                            <img src={post.cover_url} alt="" className="size-4 shrink-0 rounded-md object-cover border border-black/10 dark:border-white/10" />
                          ) : (
                            <Video className="size-3 shrink-0" />
                          )}
                          <span className="truncate flex-1 font-bold text-black/80 dark:text-white/90 leading-tight">
                            <span className="text-[8px] opacity-60 uppercase mr-0.5">
                              [{post.brand ? post.brand.split(",").map(b => b === "FRANCESCA" ? "FR" : "PB").join("&") : "PB"}]
                            </span>
                            {post.title}
                          </span>
                          
                          {/* Small Status dot */}
                          <span className={cn(
                            "size-1.5 rounded-full shrink-0",
                            post.status === "PUBLISHED" ? "bg-emerald-500" : post.status === "PLANNED" ? "bg-indigo-500" : "bg-amber-500"
                          )} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        /* Agenda Queue List View */
        <div className="space-y-3">
          {filteredPosts.length === 0 ? (
            <Card className="border border-black/5 dark:border-white/10 bg-white/90 dark:bg-neutral-900 shadow-soft p-12 text-center rounded-[30px]">
              <CalendarIcon className="size-10 mx-auto text-black/20 dark:text-white/20 mb-3" />
              <p className="text-sm font-bold text-black/50 dark:text-white/40">Nessun video programmato con i filtri attuali.</p>
              <button 
                onClick={() => openCreateForDate(new Date())}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#C66170]/10 border border-[#C66170]/20 text-[#C66170] px-4 py-2 text-xs font-bold transition hover:bg-[#C66170]/15"
              >
                Pianifica Ora
              </button>
            </Card>
          ) : (
            filteredPosts.map((post) => {
              const statusInfo = STATUSES.find((s) => s.id === post.status);
              const postDate = new Date(post.scheduled_at);
              const postPlatforms = getPlatformsList(post.platform);
              
              return (
                <Card 
                  key={post.id}
                  onClick={() => openEdit(post)}
                  className="group relative border border-black/5 dark:border-white/10 bg-white/95 dark:bg-neutral-900 shadow-soft p-4 sm:p-5 rounded-[22px] transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center"
                >
                  <div className="flex gap-4 items-center min-w-0">
                    {/* Thumbnail Cover */}
                    <div className="size-16 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-neutral-100 dark:bg-neutral-800 shrink-0 flex items-center justify-center relative">
                      {post.cover_url ? (
                        <img src={post.cover_url} alt="" className="size-full object-cover select-none pointer-events-none" />
                      ) : (
                        <Video className="size-6 text-black/20 dark:text-white/20" />
                      )}
                      
                      {/* Floating Platform Badge */}
                      <div className="absolute bottom-1 right-1 flex gap-0.5">
                        {postPlatforms.map((plat) => (
                          <span 
                            key={plat.id}
                            className={cn(
                              "px-1 py-0.5 rounded text-white font-extrabold text-[7px] bg-gradient-to-r shadow-sm uppercase shrink-0",
                              plat.color || "from-neutral-500 to-neutral-400"
                            )}
                            title={plat.name}
                          >
                            {plat.id === "ALTRO" ? "AL" : plat.id.slice(0, 2)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-[10px] font-extrabold text-black/45 dark:text-white/40 flex items-center gap-1">
                          <Clock className="size-3.5" />
                          {postDate.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })} alle {postDate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        
                        <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border", statusInfo?.color)}>
                          {statusInfo?.name}
                        </span>

                        {post.brand ? post.brand.split(",").map((brand) => (
                          <span key={brand} className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
                            {brand === "FRANCESCA" ? "Francesca" : "Paradise"}
                          </span>
                        )) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
                            Paradise
                          </span>
                        )}

                        {postPlatforms.map((plat) => (
                          <span 
                            key={plat.id}
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border",
                              plat.bgLight,
                              plat.text
                            )}
                          >
                            {plat.name}
                          </span>
                        ))}
                      </div>

                      <h3 className="text-sm font-extrabold text-black dark:text-white group-hover:text-[#C66170] transition-colors leading-snug">
                        {post.title}
                      </h3>
                      
                      {post.description && (
                        <p className="text-xs text-black/55 dark:text-white/55 truncate max-w-xl mt-1">
                          {post.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    {/* User Creator info */}
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-full overflow-hidden bg-neutral-200 border border-black/5">
                        {post.created_by.photo_url ? (
                          <img src={resolveDrivePhotoUrl(post.created_by.photo_url)} alt="" className="size-full object-cover" />
                        ) : (
                          <div className="size-full flex items-center justify-center text-[9px] font-bold text-neutral-600 uppercase">
                            {post.created_by.name.slice(0, 1)}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-black/45 dark:text-white/45">{post.created_by.name}</span>
                    </div>
                    
                    <ChevronRight className="size-4 text-black/30 dark:text-white/30 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Slideout Detail/Edit Drawer (Agenda Pro Form Style) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsFormOpen(false)}
          />

          {/* Drawer container */}
          <div className="relative w-full max-w-[500px] h-full bg-white dark:bg-[#121114] border-l border-black/5 dark:border-white/10 p-6 flex flex-col justify-between shadow-2xl z-10 overflow-y-auto luxury-scroll animate-in slide-in-from-right duration-250">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-4 mb-5">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-2xl bg-[#C66170]/10 text-[#C66170]">
                    <SlidersHorizontal className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-black dark:text-white uppercase tracking-wider">
                      {formMode === "VIEW" ? "Dettagli Video" : editingPost ? "Modifica Video" : "Programma Video"}
                    </h3>
                    <p className="text-[10px] text-black/45 dark:text-white/40">
                      {formMode === "VIEW" ? "Visualizza le informazioni del post programmato." : "Inserisci i dettagli per la pubblicazione sui social."}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 rounded-xl text-black/40 hover:bg-neutral-100 hover:text-black dark:text-white/40 dark:hover:bg-neutral-800 transition"
                >
                  <X className="size-5" />
                </button>
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
                      <span className="text-[10px] font-extrabold text-black/40 dark:text-white/40 uppercase tracking-wider block">Didascalia / Caption</span>
                      <p className="text-xs text-black/80 dark:text-white/80 whitespace-pre-wrap leading-relaxed font-semibold">
                        {editingPost.description}
                      </p>
                    </div>
                  ) : (
                    <div className="text-xs text-black/40 dark:text-white/40 italic pl-1">
                      Nessuna didascalia o caption inserita.
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

                  {/* Date & Time Picker */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold text-black/50 dark:text-white/40 uppercase tracking-wider pl-1">Data</span>
                      <Field
                        type="date"
                        value={formScheduledDate}
                        onChange={(e) => setFormScheduledDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold text-black/50 dark:text-white/40 uppercase tracking-wider pl-1">Orario</span>
                      <Field
                        type="time"
                        value={formScheduledTime}
                        onChange={(e) => setFormScheduledTime(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Status selector */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-black/50 dark:text-white/40 uppercase tracking-wider pl-1">Stato Programmazione</span>
                    <div className="grid grid-cols-3 gap-2">
                      {STATUSES.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setFormStatus(st.id)}
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

                  {/* Description */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-black/50 dark:text-white/40 uppercase tracking-wider pl-1">Didascalia / Caption Post</span>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Inserisci la descrizione, hashtag, o note della didascalia..."
                      rows={3}
                      className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#C66170]/30 transition"
                    />
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

                  {/* Thumbnail Cover Upload (Supabase storage) */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-black/50 dark:text-white/40 uppercase tracking-wider pl-1">Copertina / Thumbnail</span>
                    <div className="flex gap-4 items-center rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-3 bg-black/[0.01] dark:bg-white/[0.01]">
                      
                      {/* Preview box */}
                      <div className="size-16 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 border border-black/5 shrink-0 flex items-center justify-center relative">
                        {formCoverUrl ? (
                          <img src={formCoverUrl} alt="" className="size-full object-cover" />
                        ) : (
                          <Video className="size-5 text-black/20 dark:text-white/20" />
                        )}
                      </div>

                      <div className="flex-1">
                        <input 
                          type="file" 
                          accept="image/*" 
                          id="social-cover-input" 
                          className="hidden" 
                          onChange={handleFileUpload} 
                          disabled={uploading}
                        />
                        <label 
                          htmlFor="social-cover-input"
                          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-white dark:bg-white/10 px-3 py-1.5 text-[10px] font-extrabold shadow-sm ring-1 ring-black/5 dark:ring-white/10 hover:bg-neutral-50 dark:hover:bg-white/15 cursor-pointer active:scale-95 transition"
                        >
                          <Upload className="size-3.5" /> {uploading ? "Caricamento..." : "Carica Copertina"}
                        </label>
                        <p className="text-[9px] text-black/40 dark:text-white/40 mt-1">PNG, JPG fino a 10MB. Verrà mostrata nel calendario.</p>
                      </div>
                    </div>
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

            {/* Action buttons footer */}
            <div className="border-t border-black/5 dark:border-white/5 pt-4 mt-6 flex justify-between items-center gap-3">
              {formMode === "VIEW" && editingPost ? (
                <>
                  <div />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="inline-flex min-h-11 items-center justify-center rounded-2xl px-5 py-2.5 text-xs font-extrabold bg-neutral-100 dark:bg-neutral-800 text-black/70 dark:text-white/70 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition"
                    >
                      Chiudi
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
                      onClick={editingPost ? () => setFormMode("VIEW") : () => setIsFormOpen(false)}
                      className="inline-flex min-h-11 items-center justify-center rounded-2xl px-5 py-2.5 text-xs font-extrabold bg-neutral-100 dark:bg-neutral-800 text-black/70 dark:text-white/70 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition"
                    >
                      {editingPost ? "Annulla" : "Chiudi"}
                    </button>
                    <Button
                      onClick={handleSubmit}
                      disabled={uploading}
                      className="min-h-11"
                    >
                      {uploading ? "Salvataggio..." : "Salva Video"}
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
