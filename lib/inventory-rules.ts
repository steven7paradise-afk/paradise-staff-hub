export const inventoryManagementRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN", "RESPONSABILE"]);
export const inventoryOperationRoles = new Set([...inventoryManagementRoles, "MAGAZZINO"]);

export type InventoryOperation = "OUT" | "TRANSFER" | "RETURN" | "DAMAGED" | "ADJUSTMENT";
export type InventoryUnitStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "DAMAGED" | "LOST" | "CANCELLED";

export function normalizeInventoryCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

export function normalizeSku(value: unknown) {
  return normalizeInventoryCode(value).replace(/\s+/g, "-");
}

export function assertInventoryTransition(
  operation: InventoryOperation,
  current: InventoryUnitStatus,
  requested?: InventoryUnitStatus,
) {
  if (operation === "OUT" && !["AVAILABLE", "RESERVED"].includes(current)) {
    throw new Error(current === "SOLD" ? "Questa etichetta è già uscita: non può essere venduta due volte." : "Questa unità non è disponibile per l’uscita.");
  }
  if (operation === "TRANSFER" && !["AVAILABLE", "RESERVED"].includes(current)) {
    throw new Error("Solo un’unità disponibile o riservata può essere trasferita.");
  }
  if (operation === "RETURN" && current !== "SOLD") {
    throw new Error("Il reso è possibile solo per un’unità già uscita.");
  }
  if (operation === "DAMAGED" && !["AVAILABLE", "RESERVED"].includes(current)) {
    throw new Error("Questa unità non può essere marcata come danneggiata nello stato attuale.");
  }
  if (operation === "ADJUSTMENT" && (!requested || requested === current)) {
    throw new Error("Per la rettifica seleziona un nuovo stato diverso da quello attuale.");
  }
}

export function nextStatusForOperation(operation: InventoryOperation, requested?: InventoryUnitStatus): InventoryUnitStatus {
  if (operation === "OUT") return "SOLD";
  if (operation === "RETURN") return "AVAILABLE";
  if (operation === "DAMAGED") return "DAMAGED";
  if (operation === "ADJUSTMENT" && requested) return requested;
  throw new Error("Il trasferimento conserva lo stato dell’unità.");
}

export function formatInventoryLabelCode(sequence: bigint | number) {
  return `PB-${String(sequence).padStart(8, "0")}`;
}

