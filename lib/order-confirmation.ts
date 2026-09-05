export type OrderConfirmer = {
  id?: string;
  name: string;
  photo_url?: string | null;
};

type OrderConfirmationInput = {
  assigned_to_id?: string | null;
  activity_log?: unknown;
};

function normalizedName(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("it-IT");
}

export function resolveOrderConfirmer(
  order: OrderConfirmationInput,
  staff: Array<{ id: string; name: string; photo_url?: string | null }>,
): OrderConfirmer | null {
  if (order.assigned_to_id) {
    const assigned = staff.find((person) => person.id === order.assigned_to_id);
    if (assigned) return assigned;
  }

  const log = Array.isArray(order.activity_log) ? order.activity_log : [];
  const latestStatusChange = [...log].reverse().find((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const candidate = entry as Record<string, unknown>;
    return candidate.type === "STATUS_CHANGE" || Boolean(candidate.to);
  }) as Record<string, unknown> | undefined;
  const actorName = String(latestStatusChange?.by ?? "").trim();
  if (!actorName) return null;

  const matched = staff.find((person) => normalizedName(person.name) === normalizedName(actorName));
  return matched ?? { name: actorName, photo_url: null };
}
