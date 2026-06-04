"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

type LatestNotification = {
  id: string;
  title: string;
  message: string;
  actionUrl: string | null;
  createdAt: string;
};

function playNotificationSound() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.45, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.55);
  [880, 1175].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + index * 0.16);
    oscillator.stop(context.currentTime + index * 0.16 + 0.22);
  });
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function sendSubscriptionToServer(subscription: PushSubscription) {
  await fetch("/api/notifications/push-subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription }),
  }).catch((err) => console.error("Push registration endpoint failed", err));
}

async function subscribeToPushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();

  if (existingSubscription) {
    await sendSubscriptionToServer(existingSubscription);
    return;
  }

  const keyResponse = await fetch("/api/notifications/push-public-key");
  if (!keyResponse.ok) return;
  const { publicKey } = await keyResponse.json();
  if (!publicKey) return;

  const convertedVapidKey = urlBase64ToUint8Array(publicKey);
  const newSubscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedVapidKey,
  });

  await sendSubscriptionToServer(newSubscription);
}

export function NotificationWatcher({ initialUnread }: { initialUnread: number }) {
  const lastCount = useRef(initialUnread);
  const lastId = useRef<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );

  useEffect(() => {
    // Register Service Worker for push notifications
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("Service Worker registered with scope:", reg.scope);
          if (Notification.permission === "granted") {
            subscribeToPushNotifications().catch((err) =>
              console.error("Push subscription check failed", err),
            );
          }
        })
        .catch((err) => console.error("Service Worker registration failed:", err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const response = await fetch("/api/notifications/latest", { cache: "no-store" }).catch(() => null);
      if (!response?.ok || cancelled) return;
      const data = (await response.json()) as { count: number; latest: LatestNotification | null };
      const latestId = data.latest?.id ?? null;
      const hasNew = data.count > lastCount.current || (latestId && latestId !== lastId.current && data.count > 0);
      if (hasNew && data.latest) {
        playNotificationSound();
        if ("Notification" in window && Notification.permission === "granted") {
          const browserNotification = new Notification(data.latest.title, {
            body: data.latest.message,
            tag: data.latest.id,
            icon: "/favicon.png",
          });
          browserNotification.onclick = () => {
            window.focus();
            window.location.href = data.latest?.actionUrl || "/notifications";
          };
        }
      }
      lastCount.current = data.count;
      lastId.current = latestId;
    }

    const first = window.setTimeout(check, 5000);
    const interval = window.setInterval(check, 30000);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);

  async function enableNotifications() {
    playNotificationSound();
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    const next = await Notification.requestPermission();
    setPermission(next);
    if (next === "granted") {
      subscribeToPushNotifications().catch((err) =>
        console.error("Web Push subscribe failed", err),
      );
    }
  }

  if (permission === "granted" || permission === "unsupported") return null;

  return (
    <button
      type="button"
      onClick={enableNotifications}
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-2xl bg-[#1F1F1F] px-4 py-3 text-sm font-bold text-white shadow-2xl transition hover:scale-105 active:scale-95"
    >
      <Bell className="size-4" />
      Attiva notifiche
    </button>
  );
}
