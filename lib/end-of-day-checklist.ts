export const END_OF_DAY_COUNT_FIELDS = [
  { key: "openWhatsappChats", label: "Chat aperte su WhatsApp" },
  { key: "whiteRegisterRows", label: "Righe bianche nel registro" },
  { key: "yellowRegisterRows", label: "Righe gialle nel registro" },
  { key: "pinkUnresponsiveRows", label: "Righe rosa - clienti che non rispondono" },
  { key: "pendingRefundRequests", label: "Richieste di rimborso in attesa" },
] as const;

export const END_OF_DAY_CHANNELS = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "tiktok", label: "TikTok" },
  { key: "assistanceEmail", label: "E-mail Assistenza" },
  { key: "payMeGpt", label: "PayMeGPT" },
] as const;

export const END_OF_DAY_CONFIRMATIONS = [
  { key: "applicationBandsAndGrams", label: "Fasce e grammi indicati nella riapplicazione" },
  { key: "appointmentsInPlanning", label: "Appuntamenti verificati e inseriti correttamente nel planning" },
  { key: "missedCallsReturned", label: "Tutte le chiamate perse sono state richiamate" },
] as const;

export type EndOfDayPayload = {
  date: string;
  counts: Record<string, number>;
  channels: Record<string, boolean>;
  confirmations: Record<string, "YES" | "NO">;
  confirmationNotes: Record<string, string>;
  notes: string;
  operatorOneName: string;
  operatorTwoName: string;
  managerName: string;
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeEndOfDayPayload(value: unknown): { data?: EndOfDayPayload; error?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Dati della checklist non validi." };
  const input = value as Record<string, unknown>;
  const rawCounts = input.counts && typeof input.counts === "object" && !Array.isArray(input.counts) ? input.counts as Record<string, unknown> : {};
  const rawChannels = input.channels && typeof input.channels === "object" && !Array.isArray(input.channels) ? input.channels as Record<string, unknown> : {};
  const rawConfirmations = input.confirmations && typeof input.confirmations === "object" && !Array.isArray(input.confirmations) ? input.confirmations as Record<string, unknown> : {};
  const rawConfirmationNotes = input.confirmationNotes && typeof input.confirmationNotes === "object" && !Array.isArray(input.confirmationNotes) ? input.confirmationNotes as Record<string, unknown> : {};
  const date = cleanText(input.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Data della giornata non valida." };

  const counts: Record<string, number> = {};
  for (const field of END_OF_DAY_COUNT_FIELDS) {
    const number = Number(rawCounts[field.key]);
    if (!Number.isInteger(number) || number < 0 || number > 99999) return { error: `Inserisci un numero valido per “${field.label}”.` };
    counts[field.key] = number;
  }

  const channels: Record<string, boolean> = {};
  for (const channel of END_OF_DAY_CHANNELS) channels[channel.key] = rawChannels[channel.key] === true;

  const confirmations: Record<string, "YES" | "NO"> = {};
  const confirmationNotes: Record<string, string> = {};
  for (const confirmation of END_OF_DAY_CONFIRMATIONS) {
    const answer = rawConfirmations[confirmation.key];
    if (answer !== "YES" && answer !== "NO") return { error: `Rispondi SÌ o NO a “${confirmation.label}”.` };
    confirmations[confirmation.key] = answer;
    confirmationNotes[confirmation.key] = cleanText(rawConfirmationNotes[confirmation.key], 1200);
    if (answer === "NO" && !confirmationNotes[confirmation.key]) return { error: `Spiega cosa non è stato completato per “${confirmation.label}”.` };
  }

  const notes = cleanText(input.notes, 4000);
  if ((Object.values(channels).some((checked) => !checked) || Object.values(confirmations).includes("NO")) && !notes) {
    return { error: "Inserisci una nota finale perché sono presenti controlli non completati." };
  }
  const operatorOneName = cleanText(input.operatorOneName, 120);
  const operatorTwoName = cleanText(input.operatorTwoName, 120);
  const managerName = cleanText(input.managerName, 120);
  if (!operatorOneName || !operatorTwoName || !managerName) return { error: "Inserisci i due nomi delle addette e la presa visione del responsabile." };

  return { data: { date, counts, channels, confirmations, confirmationNotes, notes, operatorOneName, operatorTwoName, managerName } };
}

export function endOfDayAnomalyCount(value: Pick<EndOfDayPayload, "channels" | "confirmations">) {
  return Object.values(value.channels).filter((checked) => !checked).length
    + Object.values(value.confirmations).filter((answer) => answer === "NO").length;
}
