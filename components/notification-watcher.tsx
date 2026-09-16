"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Megaphone, X } from "lucide-react";

type LatestNotification = {
  id: string;
  title: string;
  message: string;
  actionUrl: string | null;
  createdAt: string;
  type: string;
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
  // Keep the server render and the browser's first render identical. Reading
  // Notification.permission during initialization causes a hydration mismatch
  // because the API does not exist while rendering on the server.
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [communication, setCommunication] = useState<Pick<LatestNotification, "id" | "title" | "message"> | null>(null);
  const dismissedCommunication = useRef<string | null>(null);

  useEffect(() => {
    setPermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  useEffect(() => {
    // Register Service Worker for push notifications
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("Service Worker registered with scope:", reg.scope);
          if ("Notification" in window && Notification.permission === "granted") {
            subscribeToPushNotifications().catch((err) =>
              console.error("Push subscription check failed", err),
            );
          }
        })
        .catch((err) => console.error("Service Worker registration failed:", err));
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      lastId.current = localStorage.getItem("last_shown_notification_id");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const response = await fetch("/api/notifications/latest", { cache: "no-store" }).catch(() => null);
      if (!response?.ok || cancelled) return;
      const data = (await response.json()) as { count: number; latest: LatestNotification | null; communication?: Pick<LatestNotification, "id" | "title" | "message"> | null };
      if (cancelled) return;
      setCommunication(data.communication?.id === dismissedCommunication.current ? null : data.communication ?? null);
      const latestId = data.latest?.id ?? null;
      const lastShownId = typeof window !== "undefined" ? localStorage.getItem("last_shown_notification_id") : null;

      const hasNew = latestId && latestId !== lastId.current && latestId !== lastShownId && data.count > 0;

      if (hasNew && data.latest) {
        if (typeof window !== "undefined") {
          localStorage.setItem("last_shown_notification_id", data.latest.id);
        }
        lastId.current = data.latest.id;

        playNotificationSound();
        if ("Notification" in window && Notification.permission === "granted") {
          const browserNotification = new Notification(data.latest.title, {
            body: data.latest.message,
            tag: data.latest.id,
            icon: "/favicon.png",
          });
          browserNotification.onclick = () => {
            window.focus();
            if (data.latest?.type === "TIMBRATURA") {
              const pauseExceeded = /pausa.*superat|superamento.*pausa/i.test(`${data.latest.title} ${data.latest.message}`);
              window.alert(`${pauseExceeded ? "Attenzione: pausa superata" : "Avviso timbratura"}\n\n${data.latest.message}`);
              return;
            }
            window.location.href = data.latest?.actionUrl || "/notifications";
          };
        }
      }
      lastCount.current = data.count;
    }

    void check();
    const interval = window.setInterval(check, 15000);
    const onFocus = () => { void check(); };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
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

  return (
    <>
    {communication && <aside aria-label="Nuova comunicazione" aria-live="polite" className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-lg rounded-xl border border-black/10 bg-white p-4 text-[#181719] shadow-xl sm:left-auto sm:right-5 sm:mx-0 sm:w-[420px]">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#F8EDF2] text-[#A93469]"><Megaphone className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#A93469]">Nuova comunicazione</p><h2 className="mt-1 break-words text-sm font-semibold">{communication.title}</h2><p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-slate-500">{communication.message.split("📄 ALLEGATO DRIVE:")[0]}</p><a href={`/notifications?communication=${encodeURIComponent(communication.id)}`} className="mt-2 inline-flex min-h-10 items-center text-sm font-semibold text-[#A93469] hover:underline">Leggi comunicazione →</a></div>
        <button type="button" onClick={() => { dismissedCommunication.current = communication.id; setCommunication(null); }} aria-label="Nascondi banner senza segnare come letta" className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="size-4" /></button>
      </div>
    </aside>}
    {permission !== "granted" && permission !== "unsupported" &&
    <button
      type="button"
      onClick={enableNotifications}
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-2xl bg-[#1F1F1F] px-4 py-3 text-sm font-bold text-white shadow-2xl transition hover:scale-105 active:scale-95"
    >
      <Bell className="size-4" />
      Attiva notifiche
    </button>}
    </>
  );
}
