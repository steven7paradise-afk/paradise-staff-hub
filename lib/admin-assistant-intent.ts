export type TeamStatusScope = "IN_TURNO" | "IN_PAUSA" | "USCITO" | "NON_ENTRATO";

type ConversationMessage = { role: "user" | "assistant"; content: string };

function statusMention(value: string): TeamStatusScope | null {
  const text = value.toLocaleLowerCase("it");
  if (/paus/.test(text)) return "IN_PAUSA";
  if (/assen|non (è |e )?ent|mancata timbratura/.test(text)) return "NON_ENTRATO";
  if (/uscit|fuori turno/.test(text)) return "USCITO";
  if (/in turno|al lavoro|lavorando/.test(text)) return "IN_TURNO";
  return null;
}

export function requestedTeamStatus(messages: ConversationMessage[]): TeamStatusScope | null {
  const lastUserIndex = messages.findLastIndex((message) => message.role === "user" && message.content.trim());
  if (lastUserIndex < 0) return null;

  const direct = statusMention(messages[lastUserIndex].content);
  if (direct) return direct;

  const isContextualFollowUp = /^(chi|quali)(\s+(è|e|sono|sarebbero))?\s*\??$/i.test(messages[lastUserIndex].content.trim())
    || /^(fammi vedere|mostrameli|mostramele|dimmi i nomi|i nomi)\s*\??$/i.test(messages[lastUserIndex].content.trim());
  if (!isContextualFollowUp) return null;

  for (let index = lastUserIndex - 1; index >= 0; index -= 1) {
    const mentioned = statusMention(messages[index].content);
    if (mentioned) return mentioned;
  }
  return null;
}
