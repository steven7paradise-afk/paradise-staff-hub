import { timingSafeEqual } from "node:crypto";

const MUTATING_ASSISTANT_TOOLS = new Set([
  "remember_instruction",
  "forget_memory",
  "prepare_communication",
]);

export function assistantApiKeyFromHeaders(headers: Pick<Headers, "get">) {
  const bearer = headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return bearer || headers.get("x-api-key")?.trim() || "";
}

export function safeSecretMatches(received: string, expected: string) {
  if (!received || !expected) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function assistantToolsForAccess<T extends { name: string }>(availableTools: readonly T[], readOnly: boolean) {
  if (!readOnly) return [...availableTools];
  return availableTools.filter((tool) => !MUTATING_ASSISTANT_TOOLS.has(tool.name));
}

export function isMutatingAssistantTool(name: string) {
  return MUTATING_ASSISTANT_TOOLS.has(name);
}
