export class ChatError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const chatManagers = new Set(["ADMIN", "SUPER_ADMIN", "ZERO", "RESPONSABILE"]);
export function text(value: unknown, max: number, label: string) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new ChatError(`${label}: lunghezza non valida (massimo ${max}).`);
  return value.trim();
}
export function roomInput(input: Record<string, unknown>, user: { id: string; role: string }) {
  const kind = input.kind;
  if (!["direct", "group", "channel"].includes(String(kind))) throw new ChatError("Tipo di conversazione non valido.");
  if (kind === "channel" && !chatManagers.has(user.role)) throw new ChatError("Solo i responsabili possono creare canali.", 403);
  if (!Array.isArray(input.members) || input.members.some(id => typeof id !== "string" || id.length > 128)) throw new ChatError("Partecipanti non validi.");
  const members = [...new Set([user.id, ...input.members as string[]])].sort();
  if (members.length < 2 || members.length > 100 || (kind === "direct" && members.length !== 2)) throw new ChatError("Seleziona i partecipanti: 2 per una chat privata, fino a 100 per gruppi e canali.");
  return { kind: kind as string, title: kind === "direct" ? "Chat privata" : text(input.title, 80, "Nome"), members,
    directKey: kind === "direct" ? JSON.stringify(members) : null };
}
// Being an administrator never implies membership in a private conversation.
export function requireMember<T>(member: T | null | undefined): T {
  if (!member) throw new ChatError("Conversazione non disponibile.", 404);
  return member;
}
export function requireOwnMessage(authorId: string, actorId: string) {
  if (authorId !== actorId) throw new ChatError("Puoi modificare solo i tuoi messaggi.", 403);
}
