export function parseMobileTaskComment(payload: { message?: unknown; commentId?: unknown }) {
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const id = typeof payload.commentId === "string" ? payload.commentId : "";
  if (!message || message.length > 5000 || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) return null;
  return { message, id };
}
