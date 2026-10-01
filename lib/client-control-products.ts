/** Product purchases must be explicitly selected, never inferred from order lines (which also contain services). */
export function clientControlProductSelection(checked: boolean) {
  return { client_control_products: checked, client_control_products_manual: checked };
}

export function restoreClientControlProducts(answers: Record<string, unknown>) {
  if (typeof answers.client_control_products_manual === "boolean") return answers.client_control_products_manual;
  // Legacy records with imported line items could have been checked automatically.
  // Ask for a fresh selection instead of treating those lines as a confirmed purchase.
  return answers.client_control_products === true && !String(answers.client_control_products_list || "").trim();
}
