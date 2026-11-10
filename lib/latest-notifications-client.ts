"use client";

export type LatestNotification = {
  id: string;
  title: string;
  message: string;
  actionUrl: string | null;
  createdAt: string;
  type: string;
};

type LatestNotifications = {
  count: number;
  latest: LatestNotification | null;
  items?: (LatestNotification & { read: boolean })[];
  communications?: (Pick<LatestNotification, "id" | "title" | "message"> & { backgroundUrl?: string | null })[];
};

const pendingByUser = new Map<string, Promise<LatestNotifications>>();

export function loadLatestNotifications(userId: string): Promise<LatestNotifications> {
  const pending = pendingByUser.get(userId);
  if (pending) return pending;

  const request = fetch("/api/notifications/latest", {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).then((response) => {
    if (!response.ok) throw new Error("Aggiornamento notifiche non riuscito");
    return response.json() as Promise<LatestNotifications>;
  }).finally(() => {
    pendingByUser.delete(userId);
  });

  pendingByUser.set(userId, request);
  return request;
}
