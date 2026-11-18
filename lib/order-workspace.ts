export type OrderWorkspace = "orders" | "conversions";
export type OrderTaskType = "conversione" | "acquisto" | "accessori" | "altro";

export type OrderWorkspaceInput = {
  answers?: unknown;
  form?: { fields?: unknown } | null;
};

// Preserve the classification already used by the order board, including old
// forms whose operational answers have different field IDs.
export function getOrderTaskType(order: OrderWorkspaceInput): OrderTaskType {
  const answers = order.answers && typeof order.answers === "object" ? order.answers : {};
  const text = Object.values(answers)
    .map((value: unknown) => value && typeof value === "object"
      ? ("name" in value ? String(value.name ?? "") : "")
      : String(value))
    .join(" ")
    .toLowerCase();

  if (text.includes("conver")) return "conversione";
  if (text.includes("accessori")) return "accessori";
  if (text.includes("acquisto") || text.includes("extension") || text.includes("nuove ext")) return "acquisto";
  return "altro";
}

export function isOrderInWorkspace(order: OrderWorkspaceInput, workspace: OrderWorkspace) {
  return (getOrderTaskType(order) === "conversione") === (workspace === "conversions");
}

export function orderStatusForWorkspace(status: string | null | undefined, workspace: OrderWorkspace) {
  if (workspace === "conversions" && status === "ORDERED") return "PREPARING";
  return status || "NEW";
}

export function orderWorkspacePath(workspace: OrderWorkspace) {
  return workspace === "conversions" ? "/conversioni" : "/orders";
}
