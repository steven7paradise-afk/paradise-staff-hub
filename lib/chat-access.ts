import { chatDB as db } from "./chat-db";
import { mobileUser } from "@/lib/mobile-auth";
import { ChatError } from "@/lib/chat-policy";
import { FORMER_EMPLOYEE_STATUS } from "@/lib/former-employee";
export async function chatActor(request: Request) {
  if (process.env.INTERNAL_CHAT_ENABLED === "false") throw new ChatError("La chat è in preparazione. Sarà disponibile dopo l’attivazione aziendale.", 503);
  const context = await mobileUser(request);
  if (!context || context.user.employee_status === FORMER_EMPLOYEE_STATUS) throw new ChatError("Accesso alla chat non consentito.", 401);
  if (context.user.must_change_password) throw new ChatError("Aggiorna prima la password.", 403);
  if (await db.setting.findUnique({ where: { key: `chat-suspended:${context.user.id}` } })) throw new ChatError("Accesso alla chat sospeso. Contatta l’assistenza aziendale.", 403);
  return context.user;
}
