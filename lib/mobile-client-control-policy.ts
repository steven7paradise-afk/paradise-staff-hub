export type AssignedMate = { id: string; name: string };
export function isAssignedWorker(userId: string, team: AssignedMate[], aliases: Record<string, { userId?: string }>) {
  return team.some((mate) => mate.id === userId || aliases[mate.id]?.userId === userId);
}

export const mobileControlKeys = ["custom_services", "custom_grammi", "custom_lunghezza", "custom_fasce", "custom_atteggiamento", "client_control_discovery_source", "client_control_discovery_other", "client_control_instagram_tag", "second_shopify_order", "custom_extra_note"] as const;

export function controlFields(answers: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(mobileControlKeys.map(key => [key,
    key === "custom_services" && Array.isArray(answers[key]) ? answers[key].join("|") : String(answers[key] ?? ""),
  ]));
}

export function controlPatch(input: unknown): Record<string, string | string[]> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const values = input as Record<string, unknown>;
  if (Object.keys(values).some(key => !mobileControlKeys.includes(key as typeof mobileControlKeys[number]))) return null;
  if (Object.values(values).some(value => typeof value !== "string" || value.length > 4000)) return null;
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key,
    key === "custom_services" ? String(value).split("|").map(s => s.trim()).filter(Boolean) : String(value).trim(),
  ]));
}
