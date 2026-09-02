import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { hasInternalEmailContent, internalEmailPlainText, isRichEmailHtml, sanitizeInternalEmailHtml } from "@/lib/internal-email-html";
import { prisma } from "@/lib/prisma";

const allowedRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);
const folders = new Set(["inbox", "important", "sent", "drafts", "archived", "trash"]);
type Attachment = { id: string; name: string; previewUrl: string; webViewLink?: string | null; mimeType?: string | null };

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function validAttachments(value: unknown): Attachment[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    if (typeof raw.id !== "string" || typeof raw.name !== "string" || typeof raw.previewUrl !== "string") return [];
    return [{ id: raw.id, name: raw.name, previewUrl: raw.previewUrl, webViewLink: typeof raw.webViewLink === "string" ? raw.webViewLink : null, mimeType: typeof raw.mimeType === "string" ? raw.mimeType : null }];
  });
}

function internalEmailHtml(recipientName: string, senderName: string, subject: string, message: string, attachments: Attachment[]) {
  const formattedMessage = isRichEmailHtml(message) ? message : escapeHtml(message).replaceAll("\n", "<br />");
  const attachmentHtml = attachments.length
    ? `<div style="margin-top:24px;padding-top:18px;border-top:1px solid #f0e4e9"><div style="margin-bottom:10px;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#a63b6b">Immagini allegate</div>${attachments.map((attachment) => `<a href="${escapeHtml(attachment.webViewLink || attachment.previewUrl)}" style="display:inline-block;margin:0 8px 8px 0;padding:9px 13px;border:1px solid #edd8e2;border-radius:12px;background:#fff5f9;color:#8f315c;font-size:12px;font-weight:700;text-decoration:none">${escapeHtml(attachment.name)}</a>`).join("")}</div>`
    : "";
  return `<!doctype html><html lang="it"><body style="margin:0;background:#f8f3f5;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#211a1e"><div style="max-width:620px;margin:0 auto;overflow:hidden;border:1px solid #efdfe7;border-radius:28px;background:#fff"><div style="padding:30px 34px;background:linear-gradient(115deg,#fff0f7,#fff 56%,#fff8f1);border-bottom:1px solid #f1e2e9"><div style="font-size:10px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#b43c72">Paradise Beauty</div><h1 style="margin:12px 0 0;font-family:Georgia,serif;font-size:28px">${escapeHtml(subject)}</h1></div><div style="padding:32px 34px"><p style="margin:0 0 18px;font-size:15px;line-height:1.65">Ciao <strong>${escapeHtml(recipientName)}</strong>,</p><div style="font-size:15px;line-height:1.75;color:#4f4148">${formattedMessage}</div>${attachmentHtml}<div style="margin-top:30px;padding-top:20px;border-top:1px solid #f0e4e9;font-size:12px;color:#8b7680">Comunicazione interna inviata da <strong>${escapeHtml(senderName)}</strong> tramite Paradise Staff Hub.</div></div></div></body></html>`;
}

async function currentSender() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, role: true, sede_id: true } });
}

export async function GET(request: NextRequest) {
  const sender = await currentSender();
  if (!sender || !allowedRoles.has(sender.role)) return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });
  const requestedFolder = request.nextUrl.searchParams.get("folder") || "inbox";
  const folder = folders.has(requestedFolder) ? requestedFolder : "inbox";
  const [inboxCount, importantCount, draftsCount, trashCount, rows] = await Promise.all([
    prisma.internalEmailRecipient.count({ where: { recipient_id: sender.id, read_at: null, deleted: false, archived: false, email: { status: "SENT" } } }),
    prisma.internalEmailRecipient.count({ where: { recipient_id: sender.id, deleted: false, starred: true, email: { status: "SENT" } } }),
    prisma.internalEmail.count({ where: { sender_id: sender.id, status: "DRAFT", sender_deleted: false } }),
    prisma.internalEmailRecipient.count({ where: { recipient_id: sender.id, deleted: true, email: { status: "SENT" } } }),
    folder === "sent" || folder === "drafts"
      ? prisma.internalEmail.findMany({ where: { sender_id: sender.id, status: folder === "drafts" ? "DRAFT" : "SENT", sender_deleted: false }, include: { sender: { select: { id: true, name: true, email: true, photo_url: true } }, recipients: { include: { recipient: { select: { id: true, name: true, email: true, photo_url: true } } } } }, orderBy: { updated_at: "desc" }, take: 200 })
      : prisma.internalEmailRecipient.findMany({ where: { recipient_id: sender.id, email: { status: "SENT" }, ...(folder === "important" ? { starred: true, deleted: false } : {}), ...(folder === "archived" ? { archived: true, deleted: false } : {}), ...(folder === "trash" ? { deleted: true } : {}), ...(folder === "inbox" ? { archived: false, deleted: false } : {}) }, include: { email: { include: { sender: { select: { id: true, name: true, email: true, photo_url: true } }, recipients: { include: { recipient: { select: { id: true, name: true, email: true, photo_url: true } } } } } } }, orderBy: { created_at: "desc" }, take: 200 }),
  ]);
  const messages = rows.map((row: any) => {
    const email = row.email || row;
    const recipientRow = row.email ? row : null;
    return { id: email.id, recipientRecordId: recipientRow?.id || null, subject: email.subject, body: isRichEmailHtml(email.body) ? sanitizeInternalEmailHtml(email.body) : email.body, status: email.status, createdAt: email.created_at.toISOString(), updatedAt: email.updated_at.toISOString(), sender: email.sender, recipients: email.recipients.map((recipient: any) => recipient.recipient), draftRecipientIds: Array.isArray(email.draft_recipient_ids) ? email.draft_recipient_ids : [], attachments: validAttachments(email.attachments), read: recipientRow ? Boolean(recipientRow.read_at) : true, starred: recipientRow ? recipientRow.starred : false, archived: recipientRow ? recipientRow.archived : false, deleted: recipientRow ? recipientRow.deleted : email.sender_deleted };
  });
  return NextResponse.json({ messages, counts: { inbox: inboxCount, important: importantCount, drafts: draftsCount, trash: trashCount } });
}

export async function POST(request: NextRequest) {
  try {
  const sender = await currentSender();
  if (!sender || !allowedRoles.has(sender.role)) return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });
  const payload = await request.json().catch(() => null);
  const mode = payload?.mode === "draft" ? "draft" : "send";
  const draftId = typeof payload?.draftId === "string" ? payload.draftId : null;
  const recipientIds: string[] = Array.from(
    new Set<string>(
      (Array.isArray(payload?.recipientIds) ? payload.recipientIds : []).filter(
        (id: unknown): id is string => typeof id === "string" && id.length > 0,
      ),
    ),
  ).slice(0, 150);
  const subject = String(payload?.subject || "").trim();
  const rawMessage = String(payload?.message || "").trim();
  const htmlFormat = payload?.format === "html";
  const sanitizedMessage = htmlFormat ? sanitizeInternalEmailHtml(rawMessage) : rawMessage;
  const message = htmlFormat && sanitizedMessage && !isRichEmailHtml(sanitizedMessage) ? `<div>${sanitizedMessage.replaceAll("\n", "<br>")}</div>` : sanitizedMessage;
  const attachments = validAttachments(payload?.attachments);
  if (mode === "send" && (!recipientIds.length || !subject || !hasInternalEmailContent(message))) return NextResponse.json({ error: "Seleziona i destinatari e inserisci oggetto e messaggio." }, { status: 400 });
  if (subject.length > 160 || rawMessage.length > 30000 || internalEmailPlainText(message).length > 10000) return NextResponse.json({ error: "Il contenuto dell’email è troppo lungo." }, { status: 400 });
  const recipients = await prisma.user.findMany({ where: { id: { in: recipientIds }, active: true }, select: { id: true, name: true, email: true } });
  if (mode === "send" && !recipients.length) return NextResponse.json({ error: "Nessun destinatario autorizzato trovato." }, { status: 400 });
  const data = { subject: subject || "Senza oggetto", body: message, draft_recipient_ids: recipientIds as Prisma.InputJsonValue, attachments: attachments as unknown as Prisma.InputJsonValue, status: mode === "draft" ? "DRAFT" : "SENT" };
  const email = await prisma.$transaction(async (tx) => {
    const existingDraft = draftId ? await tx.internalEmail.findFirst({ where: { id: draftId, sender_id: sender.id, status: "DRAFT" } }) : null;
    const saved = existingDraft ? await tx.internalEmail.update({ where: { id: existingDraft.id }, data }) : await tx.internalEmail.create({ data: { ...data, sender_id: sender.id } });
    if (mode === "send") {
      await tx.internalEmailRecipient.createMany({ data: recipients.map((recipient) => ({ email_id: saved.id, recipient_id: recipient.id })), skipDuplicates: true });
      await tx.notification.createMany({ data: recipients.map((recipient) => ({ user_id: recipient.id, title: subject, message: `Nuova email interna da ${sender.name}`, type: "EMAIL_INTERNA", action_url: `/email?message=${encodeURIComponent(saved.id)}`, read: false })) });
    }
    return saved;
  });
  if (mode === "draft") return NextResponse.json({ draftId: email.id, saved: true });
  const outcomes = await Promise.all(recipients.map(async (recipient) => {
    try { const outcome = await sendEmail({ to: recipient.email, subject, html: internalEmailHtml(recipient.name, sender.name, subject, message, attachments) }); return outcome.skipped ? "skipped" : "sent"; }
    catch (error) { console.error("Internal email external delivery failed", { recipientId: recipient.id, error }); return "failed"; }
  }));
  return NextResponse.json({ id: email.id, sent: recipients.length, externalSent: outcomes.filter((item) => item === "sent").length, externalSkipped: outcomes.filter((item) => item === "skipped").length, externalFailed: outcomes.filter((item) => item === "failed").length });
  } catch (error) {
    console.error("Internal email save failed", error);
    return NextResponse.json({ error: "Impossibile salvare l’email. Riprova tra poco." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const sender = await currentSender();
  if (!sender || !allowedRoles.has(sender.role)) return NextResponse.json({ error: "Non autorizzato." }, { status: 403 });
  const payload = await request.json().catch(() => null);
  const emailId = String(payload?.emailId || "");
  const action = String(payload?.action || "");
  if (!emailId) return NextResponse.json({ error: "Email non valida." }, { status: 400 });
  if (action === "delete-draft") { await prisma.internalEmail.deleteMany({ where: { id: emailId, sender_id: sender.id, status: "DRAFT" } }); return NextResponse.json({ ok: true }); }
  if (action === "delete-sent") { await prisma.internalEmail.updateMany({ where: { id: emailId, sender_id: sender.id }, data: { sender_deleted: true } }); return NextResponse.json({ ok: true }); }
  const data = action === "read" ? { read_at: new Date() } : action === "unread" ? { read_at: null } : action === "star" ? { starred: Boolean(payload?.value) } : action === "archive" ? { archived: true, deleted: false } : action === "delete" ? { deleted: true } : action === "restore" ? { deleted: false, archived: false } : null;
  if (!data) return NextResponse.json({ error: "Azione non valida." }, { status: 400 });
  await prisma.internalEmailRecipient.updateMany({ where: { email_id: emailId, recipient_id: sender.id }, data });
  return NextResponse.json({ ok: true });
}
