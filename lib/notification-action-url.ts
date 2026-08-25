export type NotificationActionItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  actionUrl: string | null;
};

function serviceFormResponseId(actionUrl: string | null) {
  if (!actionUrl) return null;
  const match = actionUrl.match(/^\/service-forms\/responses\/([^/?#]+)/i);
  if (!match?.[1]) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function isAttendanceNotification(item: NotificationActionItem) {
  if (item.type === "TASK" || item.type === "COMUNICAZIONE" || item.type === "FORM") return false;
  const text = `${item.title} ${item.message} ${item.type}`.toLowerCase();
  return item.type === "TIMBRATURA" || /superamento limite pausa|pausa|uscit|timbram|timbratura/.test(text);
}

export function buildServiceFormNotificationActionUrl(formName: string, responseId: string) {
  const normalizedName = formName.toLowerCase();
  const encodedId = encodeURIComponent(responseId);

  if (normalizedName.includes("rimbor")) {
    return `/refunds?rimborso=${encodedId}#rimborso-${encodedId}`;
  }

  if (normalizedName.includes("fattur") || normalizedName.includes("invoice")) {
    return `/invoices?fattura=${encodedId}`;
  }

  if (normalizedName.includes("ordine") || normalizedName.includes("order")) {
    return `/orders?ordine=${encodedId}`;
  }

  return `/service-forms/responses/${encodedId}`;
}

/**
 * Resolves legacy notification URLs too, so notifications already saved in the
 * database open the same operational pages as newly-created notifications.
 */
export function resolveNotificationActionUrl(item: NotificationActionItem, options?: { isOrder?: boolean }) {
  if (item.type === "COMUNICAZIONE") {
    return `/notifications?communication=${encodeURIComponent(item.id)}&direct=1`;
  }

  if (isAttendanceNotification(item)) {
    return `/notifications?notice=${encodeURIComponent(item.id)}&section=attendance`;
  }

  if (item.type === "TASK" && (!item.actionUrl || /^\/tasks\/?$/i.test(item.actionUrl))) {
    return `/tasks?notification=${encodeURIComponent(item.id)}`;
  }

  const responseId = serviceFormResponseId(item.actionUrl);
  if (responseId) {
    const text = `${item.title} ${item.message}`.toLowerCase();
    if (text.includes("rimbor")) {
      return buildServiceFormNotificationActionUrl("rimborso", responseId);
    }
    if (text.includes("fattur") || text.includes("invoice")) {
      return buildServiceFormNotificationActionUrl("fattura", responseId);
    }
    if (options?.isOrder || text.includes("ordine") || text.includes("order")) {
      return buildServiceFormNotificationActionUrl("ordine", responseId);
    }
  }

  if (item.actionUrl && !item.actionUrl.startsWith("/notifications")) {
    return item.actionUrl;
  }

  return item.type === "FORM" ? "/service-forms" : "/notifications";
}
