"use client";

import React, { useState } from "react";
import { MessageSquare, Send, Loader2 } from "lucide-react";

type Comment = {
  id: string;
  userName: string;
  userRole: string;
  message: string;
  createdAt: string;
};

export function ResponseComments({
  responseId,
  initialComments = [],
  currentUserName,
  currentUserRole,
  onCommentsUpdate,
}: {
  responseId: string;
  initialComments?: any[];
  currentUserName: string;
  currentUserRole: string;
  onCommentsUpdate: (updatedComments: any[]) => void;
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

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    const commentObj: Comment = {
      id: `comment_${Date.now()}`,
      userName: currentUserName,
      userRole: currentUserRole,
      message: newComment.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedComments = [...comments, commentObj];

    try {
      const res = await fetch(`/api/service-forms/responses/${responseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: updatedComments }),
      });

      if (res.ok) {
        setComments(updatedComments);
        onCommentsUpdate(updatedComments);
        setNewComment("");
      } else {
        alert("Errore nell'invio del commento.");
      }
    } catch (err) {
      console.error("Failed to add comment:", err);
      alert("Si è verificato un errore, riprova.");
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
              <p className="text-black/85 dark:text-white/85 whitespace-pre-line">{c.message}</p>
            </div>
          );
        })}

        {comments.length === 0 && (
          <p className="text-xs text-black/45 dark:text-white/40 italic py-2">
            Nessun commento presente. Scrivi una nota o rispondi qui sotto.
          </p>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendComment} className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Scrivi una risposta o annotazione..."
          className="flex-1 h-9 rounded-xl border border-black/10 dark:border-white/10 px-3 text-xs focus:border-[#A74758] bg-white dark:bg-neutral-800 text-black dark:text-white outline-none"
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={submitting || !newComment.trim()}
          className="grid size-9 place-items-center rounded-xl bg-[#A74758] text-white hover:scale-105 active:scale-95 transition disabled:opacity-40"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </button>
      </form>
    </div>
  );
}
