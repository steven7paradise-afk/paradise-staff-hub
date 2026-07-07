"use client";

import React, { useState } from "react";
import { MessageSquare, Send, Loader2, Camera, X } from "lucide-react";

type Comment = {
  id: string;
  userName: string;
  userRole: string;
  message: string;
  imageUrl?: string;
  createdAt: string;
};

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

export function ResponseComments({
  responseId,
  initialComments = [],
  currentUserName,
  currentUserRole,
  onCommentsUpdate,
  readOnly = false,
}: {
  responseId: string;
  initialComments?: any[];
  currentUserName: string;
  currentUserRole: string;
  onCommentsUpdate: (updatedComments: any[]) => void;
  readOnly?: boolean;
}) {
  const [comments, setComments] = useState<Comment[]>(() => {
    if (!initialComments) return [];
    if (Array.isArray(initialComments)) return initialComments as Comment[];
    try {
      return JSON.parse(initialComments as any) as Comment[];
    } catch {
      return [];
    }
  });
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Carica solo immagini.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert("L'immagine deve essere inferiore a 10 MB.");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || (!newComment.trim() && !selectedFile)) return;

    setSubmitting(true);
    let uploadedImageUrl = "";

    try {
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error("Errore durante il caricamento dell'immagine.");
        }

        const uploadData = await uploadRes.json();
        uploadedImageUrl = uploadData.url;
      }

      const commentObj: Comment = {
        id: `comment_${Date.now()}`,
        userName: currentUserName,
        userRole: currentUserRole,
        message: newComment.trim(),
        imageUrl: uploadedImageUrl || undefined,
        createdAt: new Date().toISOString(),
      };

      const updatedComments = [...comments, commentObj];

      const res = await fetch(`/api/service-forms/responses/${responseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: updatedComments }),
      });

      if (res.ok) {
        setComments(updatedComments);
        onCommentsUpdate(updatedComments);
        setNewComment("");
        setSelectedFile(null);
        setPreviewUrl(null);
      } else {
        alert("Errore nell'invio del commento.");
      }
    } catch (err: any) {
      console.error("Failed to add comment:", err);
      alert(err.message || "Si è verificato un errore, riprova.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 border-t border-black/5 dark:border-white/10 pt-5 mt-5">
      <div className="flex items-center gap-2 text-sm font-bold text-black/75 dark:text-white/80">
        <MessageSquare className="size-4 text-[#A74758]" />
        <span>Commenti e Note ({comments.length})</span>
      </div>

      {/* List */}
      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
        {comments.map((c) => {
          const isManager = c.userRole !== "DIPENDENTE";
          return (
            <div
              key={c.id}
              className={`rounded-2xl p-3 text-xs leading-relaxed max-w-[85%] ${
                isManager 
                  ? "bg-[#A74758]/5 border border-[#A74758]/10 mr-auto text-left" 
                  : "bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 ml-auto text-left"
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="font-bold text-black dark:text-white">
                  {c.userName} ({isManager ? "Direzione" : "Staff"})
                </span>
                <span className="text-[10px] text-black/40 dark:text-white/40">
                  {new Date(c.createdAt).toLocaleString("it-IT", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {c.message && (
                <p className="text-black/85 dark:text-white/85 whitespace-pre-line">{renderTextWithLinks(c.message)}</p>
              )}
              {c.imageUrl && (
                <div className="mt-2 rounded-xl overflow-hidden border border-black/5 dark:border-white/10 max-h-48 max-w-full">
                  <a href={c.imageUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={c.imageUrl}
                      alt="Allegato"
                      className="max-h-48 object-contain cursor-zoom-in hover:opacity-90 transition mx-auto"
                    />
                  </a>
                </div>
              )}
            </div>
          );
        })}

        {comments.length === 0 && (
          <p className="text-xs text-black/45 dark:text-white/40 italic py-2">
            Nessun commento presente. Scrivi una nota o rispondi qui sotto.
          </p>
        )}
      </div>

      {readOnly ? (
        <p className="rounded-xl bg-black/5 px-3 py-2 text-xs font-semibold text-black/45 dark:bg-white/5 dark:text-white/40">
          Solo visualizzazione: puoi leggere aggiornamenti e allegati, ma non modificare questo modulo.
        </p>
      ) : (
        <form onSubmit={handleSendComment} className="space-y-2">
          {previewUrl && (
            <div className="relative inline-block mt-1">
              <img src={previewUrl} alt="Anteprima allegato" className="h-16 rounded-xl border border-black/10 object-cover" />
              <button
                type="button"
                onClick={handleRemoveFile}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-sm hover:scale-105 active:scale-95 transition"
              >
                <X className="size-3" />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={selectedFile ? "Aggiungi descrizione o premi Invia..." : "Scrivi una risposta o annotazione..."}
              className="flex-1 h-9 rounded-xl border border-black/10 dark:border-white/10 px-3 text-xs focus:border-[#A74758] bg-white dark:bg-neutral-800 text-black dark:text-white outline-none"
              disabled={submitting}
            />
            <label className="grid size-9 place-items-center rounded-xl border border-black/10 bg-white hover:bg-neutral-50 dark:bg-neutral-800 dark:border-white/10 dark:hover:bg-neutral-700 cursor-pointer active:scale-95 transition select-none">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={submitting}
                className="hidden"
              />
              <Camera className="size-4 text-black/55 dark:text-white/60" />
            </label>
            <button
              type="submit"
              disabled={submitting || (!newComment.trim() && !selectedFile)}
              className="grid size-9 place-items-center rounded-xl bg-[#A74758] text-white hover:scale-105 active:scale-95 transition disabled:opacity-40"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
