type OrderVisibilityInput = {
  user_location_id?: string | null;
  user_location_name?: string | null;
  user?: {
    sede_id?: string | null;
    location?: { name?: string | null } | null;
  } | null;
};

function isOfficeLocation(value: unknown) {
  return String(value ?? "").trim().toLowerCase().includes("ufficio");
}

/**
 * A salon workstation sees its own orders plus every order created by the
 * central office. The response location is also considered because office
 * staff can explicitly create an order for a salon.
 */
export function isOrderVisibleForOperationalLocation(
  order: OrderVisibilityInput,
  operationalLocationId: string,
) {
  if (!operationalLocationId) return true;
  if (order.user?.sede_id === operationalLocationId) return true;
  if (order.user_location_id === operationalLocationId) return true;
  return isOfficeLocation(order.user?.location?.name) || isOfficeLocation(order.user_location_name);
}
