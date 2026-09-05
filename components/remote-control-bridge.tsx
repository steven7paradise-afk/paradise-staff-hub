"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, MousePointer2, Radio, X } from "lucide-react";

type RemoteSession = {
  sessionId?: string;
  targetCode: string;
  controllerName: string;
  mode?: "control" | "observe";
  workerId: string | null;
  pathname: string;
  search: string;
  pointer: { x: number; y: number; revision: number } | null;
  input: { selector: string; value: string; revision: number } | null;
  click: { x: number; y: number; selector?: string; label?: string; tag?: string; revision: number } | null;
  scroll: { x: number; y: number; revision: number } | null;
  events?: RemoteEvent[];
  eventRevision?: number;
};

type RemoteEvent =
  | { kind: "click"; x: number; y: number; selector?: string; label?: string; tag?: string; revision: number }
  | { kind: "input"; selector: string; value: string; checked?: boolean; fieldTag?: string; fieldType?: string; revision: number }
  | { kind: "key"; selector: string; key: string; code?: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; revision: number }
  | { kind: "scroll"; x: number; y: number; revision: number };

type OutgoingEvent =
  | { kind: "click"; x: number; y: number; selector?: string; label?: string; tag?: string }
  | { kind: "input"; selector: string; value: string; checked?: boolean; fieldTag?: string; fieldType?: string }
  | { kind: "key"; selector: string; key: string; code?: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }
  | { kind: "scroll"; x: number; y: number };

function selectorFor(element: Element) {
  if (element.id) return `#${CSS.escape(element.id)}`;
  const remoteId = element.getAttribute("data-remote-id");
  if (remoteId) return `[data-remote-id="${CSS.escape(remoteId)}"]`;
  const name = element.getAttribute("name");
  if (name) return `${element.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
  const placeholder = element.getAttribute("placeholder");
  if (placeholder) return `${element.tagName.toLowerCase()}[placeholder="${CSS.escape(placeholder)}"]`;
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) return `${element.tagName.toLowerCase()}[aria-label="${CSS.escape(ariaLabel)}"]`;
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.body && parts.length < 6) {
    const parent: Element | null = current.parentElement;
    if (!parent) break;
    const siblings = Array.from(parent.children).filter((item) => item.tagName === current!.tagName);
    parts.unshift(`${current.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(current) + 1})`);
    current = parent;
  }
  return parts.join(" > ");
}

function normalizedLabel(element: Element | null) {
  return String(element?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
}

function resolveClickable(event: Extract<RemoteEvent, { kind: "click" }>) {
  let selected = event.selector
    ? document.querySelector(event.selector) as HTMLElement | null
    : null;
  const expectedLabel = event.label || "";
  if (selected && expectedLabel && normalizedLabel(selected) !== expectedLabel) selected = null;
  if (!selected && expectedLabel) {
    const selector = event.tag && /^[a-z][a-z0-9-]*$/.test(event.tag)
      ? event.tag
      : "button,a,[role='button'],label,input,textarea,select";
    selected = Array.from(document.querySelectorAll<HTMLElement>(selector))
      .find((element) => normalizedLabel(element) === expectedLabel) || null;
  }
  const fallback = document.elementFromPoint(
    event.x * window.innerWidth,
    event.y * window.innerHeight,
  ) as HTMLElement | null;
  return selected || fallback?.closest<HTMLElement>("button,a,[role='button'],label,input,textarea,select") || fallback;
}

function applyInputEvent(event: Extract<RemoteEvent, { kind: "input" }>) {
  const field = document.querySelector(event.selector) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  if (!field || (field instanceof HTMLInputElement && ["password", "file"].includes(field.type))) return;
  field.focus({ preventScroll: true });
  if (field instanceof HTMLInputElement && typeof event.checked === "boolean") {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
    if (setter) setter.call(field, event.checked);
    else field.checked = event.checked;
  } else {
    const prototype = field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : field instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(field, event.value);
    else field.value = event.value;
  }
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function applyKeyEvent(event: Extract<RemoteEvent, { kind: "key" }>) {
  const field = document.querySelector(event.selector) as HTMLElement | null;
  if (!field) return;
  field.focus({ preventScroll: true });
  const options: KeyboardEventInit = {
    bubbles: true,
    cancelable: true,
    key: event.key,
    code: event.code,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
  };
  field.dispatchEvent(new KeyboardEvent("keydown", options));
  field.dispatchEvent(new KeyboardEvent("keyup", options));
  if (event.key === "Enter" && !(field instanceof HTMLTextAreaElement)) {
    const form = field.closest("form") as HTMLFormElement | null;
    if (form) form.requestSubmit();
  }
}

export function RemoteControlBridge({ pcMode = false }: { pcMode?: boolean }) {
  const router = useRouter();
  const [pcSession, setPcSession] = useState<RemoteSession | null>(null);
  const [controllerTarget, setControllerTarget] = useState("");
  const [reconnectRequest, setReconnectRequest] = useState<{ requestedBy: string } | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const lastInputRevision = useRef(0);
  const lastClickRevision = useRef(0);
  const lastPath = useRef("");
  const lastScrollRevision = useRef(0);
  const lastEventRevision = useRef(0);
  const activeSessionId = useRef("");
  const stopping = useRef(false);

  useEffect(() => {
    if (!pcMode) return;
    let cancelled = false;
    let polling = false;
    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const response = await fetch("/api/remote-control?mode=pc", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        const remote = (data?.session || null) as RemoteSession | null;
        if (cancelled) return;
        setPcSession(remote);
        setReconnectRequest(data?.reconnectRequest || null);
        if (!remote) return;

        const sessionIdentity = remote.sessionId || `legacy:${remote.targetCode}`;
        if (activeSessionId.current !== sessionIdentity) {
          activeSessionId.current = sessionIdentity;
          lastEventRevision.current = 0;
          lastInputRevision.current = 0;
          lastClickRevision.current = 0;
          lastScrollRevision.current = 0;
          lastPath.current = "";
        }

        if (remote.mode === "observe") return;

        const params = new URLSearchParams(remote.search || "");
        params.delete("remoteTarget");
        const salone = params.get("salone") || "buenos-aires";
        let targetPath = remote.pathname;
        if (targetPath === "/appointments") targetPath = `/appointments/${salone}`;
        const cleanSearch = params.toString();
        const wanted = `${targetPath}${cleanSearch ? `?${cleanSearch}` : ""}`;
        const here = `${window.location.pathname}${window.location.search}`;
        if (wanted !== here && wanted !== lastPath.current) {
          // Navigate before replaying the event. Otherwise a click belonging to
          // the next page is consumed against the old DOM and its popup is lost.
          lastPath.current = wanted;
          router.replace(wanted);
          return;
        }

        const eventStorageKey = `paradise-remote-event:${remote.targetCode}:${sessionIdentity}`;
        const storedEventRevision = Number(window.sessionStorage.getItem(eventStorageKey) || 0);
        let appliedEventRevision = Math.max(lastEventRevision.current, Number.isFinite(storedEventRevision) ? storedEventRevision : 0);
        const orderedEvents = (remote.events || [])
          .filter((event) => event.revision > appliedEventRevision)
          .sort((left, right) => left.revision - right.revision);
        for (const event of orderedEvents) {
          if (event.kind === "click") {
            const clickable = resolveClickable(event);
            if (clickable && !clickable.closest("[data-remote-stop]")) clickable.click();
          } else if (event.kind === "input") {
            applyInputEvent(event);
          } else if (event.kind === "key") {
            applyKeyEvent(event);
          } else if (event.kind === "scroll") {
            const maxX = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
            const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
            window.scrollTo({ left: event.x * maxX, top: event.y * maxY, behavior: "auto" });
          }
          appliedEventRevision = event.revision;
          lastEventRevision.current = event.revision;
          window.sessionStorage.setItem(eventStorageKey, String(event.revision));
        }

        const clickStorageKey = `paradise-remote-click:${remote.targetCode}`;
        const storedClickRevision = Number(window.sessionStorage.getItem(clickStorageKey) || 0);
        const appliedClickRevision = Math.max(lastClickRevision.current, Number.isFinite(storedClickRevision) ? storedClickRevision : 0);
        if (!remote.events?.length && remote.click && remote.click.revision > appliedClickRevision) {
          lastClickRevision.current = remote.click.revision;
          window.sessionStorage.setItem(clickStorageKey, String(remote.click.revision));
          const clickable = resolveClickable({ kind: "click", ...remote.click });
          if (clickable && !clickable.closest("[data-remote-stop]")) clickable.click();
        }

        if (!remote.events?.length && remote.scroll && remote.scroll.revision > lastScrollRevision.current) {
          lastScrollRevision.current = remote.scroll.revision;
          const maxX = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
          const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
          window.scrollTo({ left: remote.scroll.x * maxX, top: remote.scroll.y * maxY, behavior: "auto" });
        }

        if (!remote.events?.length && remote.input && remote.input.revision > lastInputRevision.current) {
          lastInputRevision.current = remote.input.revision;
          const field = document.querySelector(remote.input.selector) as HTMLInputElement | HTMLTextAreaElement | null;
          if (field && field.type !== "password" && field.type !== "file") {
            const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
            if (setter) setter.call(field, remote.input.value);
            else field.value = remote.input.value;
            field.dispatchEvent(new Event("input", { bubbles: true }));
            field.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }

      } catch {
        // A temporary network failure must not interrupt the cashier screen.
      } finally {
        polling = false;
      }
    };
    void poll();
    const interval = window.setInterval(poll, 220);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [pcMode, router]);

  useEffect(() => {
    if (!pcMode || pcSession?.mode !== "observe" || !pcSession.targetCode) return;
    const targetCode = pcSession.targetCode;
    let timer: number | null = null;
    let pending: Record<string, unknown> = {};
    let lastPointerSent = 0;
    let lastLocation = `${window.location.pathname}${window.location.search}`;
    let snapshotting = false;
    const send = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      const payload = pending;
      pending = {};
      void fetch("/api/remote-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "observe_update",
          targetCode,
          pathname: window.location.pathname,
          search: window.location.search,
          ...payload,
        }),
        keepalive: true,
      }).catch(() => undefined);
    };
    const queue = (payload: Record<string, unknown>, immediate = false) => {
      pending = { ...pending, ...payload };
      if (immediate) send();
      else if (timer === null) timer = window.setTimeout(send, 180);
    };
    const safeLabel = (element: Element | null, fallback: string) => {
      if (!element) return fallback;
      const field = element.closest("input,textarea,select") as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (field instanceof HTMLInputElement && ["password", "file"].includes(field.type)) return "";
      const identifyingText = `${field?.getAttribute("name") || ""} ${field?.getAttribute("autocomplete") || ""} ${field?.getAttribute("aria-label") || ""}`;
      if (/password|pin|passcode|file|allegat/i.test(identifyingText)) return "";
      const label = field
        ? field.getAttribute("aria-label") || field.getAttribute("placeholder") || field.labels?.[0]?.textContent || fallback
        : normalizedLabel(element) || element.getAttribute("aria-label") || fallback;
      return String(label).replace(/\s+/g, " ").trim().slice(0, 120);
    };
    const onPointer = (event: PointerEvent) => {
      const now = performance.now();
      if (now - lastPointerSent < 140) return;
      lastPointerSent = now;
      queue({ pointer: { x: event.clientX / Math.max(1, window.innerWidth), y: event.clientY / Math.max(1, window.innerHeight) } });
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest("[data-remote-status],[data-remote-stop]")) return;
      const actionable = target?.closest("button,a,[role='button'],label,input,textarea,select") || target;
      const label = safeLabel(actionable, "Azione selezionata");
      if (label) queue({ event: { kind: "click", label } }, true);
      window.setTimeout(() => void captureSnapshot(), 220);
    };
    const onField = (event: Event) => {
      const target = event.target as Element | null;
      const label = safeLabel(target, "Compilazione campo");
      if (label) queue({ event: { kind: "field", label: `Sta compilando: ${label}` } });
    };
    const onScroll = () => {
      const maxX = Math.max(1, document.documentElement.scrollWidth - window.innerWidth);
      const maxY = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      queue({ scroll: { x: window.scrollX / maxX, y: window.scrollY / maxY } });
    };
    const captureSnapshot = async () => {
      if (snapshotting || document.visibilityState !== "visible") return;
      snapshotting = true;
      try {
        const { toJpeg } = await import("html-to-image");
        const sourceWidth = Math.max(320, window.innerWidth);
        const sourceHeight = Math.max(320, window.innerHeight);
        const outputWidth = Math.min(1280, sourceWidth);
        const outputHeight = Math.round(sourceHeight * (outputWidth / sourceWidth));
        const snapshot = await toJpeg(document.body, {
          quality: 0.42,
          width: sourceWidth,
          height: sourceHeight,
          canvasWidth: outputWidth,
          canvasHeight: outputHeight,
          pixelRatio: 1,
          skipFonts: true,
          style: {
            transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)`,
            transformOrigin: "top left",
          },
          filter: (node) => {
            if (!(node instanceof Element)) return true;
            if (node.matches("input, textarea, select, iframe, video, [contenteditable='true'], [data-remote-status], [data-remote-private]")) return false;
            const ownText = node.children.length === 0 ? String(node.textContent || "") : "";
            return !/password|parola chiave|\bpin\b|codice di accesso/i.test(ownText);
          },
        });
        queue({ snapshot, viewport: { width: sourceWidth, height: sourceHeight } }, true);
      } catch {
        // Some third-party images cannot be copied; activity and pointer data
        // continue to work even when an individual frame cannot be rendered.
      } finally {
        snapshotting = false;
      }
    };
    const heartbeat = window.setInterval(() => queue({}, true), 8_000);
    const snapshotInterval = window.setInterval(() => void captureSnapshot(), 1_800);
    const locationWatcher = window.setInterval(() => {
      const current = `${window.location.pathname}${window.location.search}`;
      if (current === lastLocation) return;
      lastLocation = current;
      queue({ event: { kind: "navigation", label: `Ha aperto ${document.title || window.location.pathname}` } }, true);
    }, 400);
    queue({ event: { kind: "navigation", label: `Pagina aperta: ${document.title || window.location.pathname}` } }, true);
    void captureSnapshot();
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onField, true);
    document.addEventListener("change", onField, true);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.clearInterval(heartbeat);
      window.clearInterval(snapshotInterval);
      window.clearInterval(locationWatcher);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onField, true);
      document.removeEventListener("change", onField, true);
    };
  }, [pcMode, pcSession?.mode, pcSession?.sessionId, pcSession?.targetCode]);

  async function acknowledgeReconnect() {
    if (reconnecting) return;
    setReconnecting(true);
    const response = await fetch("/api/remote-control?mode=pc", { cache: "no-store" }).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => null) : null;
    const targetCode = data?.session?.targetCode || data?.target?.code;
    if (targetCode) {
      await fetch("/api/remote-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ack_reconnect", targetCode }),
      }).catch(() => undefined);
    }
    window.location.reload();
  }

  useEffect(() => {
    if (pcMode) return;
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("remotePreview") === "1") return;
    const targetCode = searchParams.get("remoteTarget");
    if (!targetCode) return;
    setControllerTarget(targetCode);
    let pending: Record<string, unknown> = {};
    let pendingEvents: OutgoingEvent[] = [];
    let timer: number | null = null;
    let inFlight: Promise<void> | null = null;
    let lastPointerSent = 0;
    let lastKnownLocation = `${window.location.pathname}${window.location.search}`;

    const drain = async (): Promise<void> => {
      if (stopping.current) return;
      if (inFlight) {
        await inFlight;
        if (Object.keys(pending).length || pendingEvents.length) await drain();
        return;
      }
      if (!Object.keys(pending).length && pendingEvents.length === 0) return;
      const payloadFields = pending;
      const payloadEvents = pendingEvents;
      const payload = { ...payloadFields, events: payloadEvents };
      pending = {};
      pendingEvents = [];
      inFlight = (async () => {
        try {
          const response = await fetch("/api/remote-control", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "update", targetCode, pathname: window.location.pathname, search: window.location.search, ...payload }),
            keepalive: true,
          });
          if (!response.ok) throw new Error("remote update failed");
        } catch {
          // Put unsent events back at the front, preserving the exact order.
          pending = { ...payloadFields, ...pending };
          pendingEvents = [...payloadEvents, ...pendingEvents].slice(-120);
          await new Promise((resolve) => window.setTimeout(resolve, 500));
        }
      })();
      await inFlight;
      inFlight = null;
      if (Object.keys(pending).length || pendingEvents.length) await drain();
    };
    const queueEvent = (event: OutgoingEvent, immediate = false) => {
      const previousEvent = pendingEvents[pendingEvents.length - 1];
      if (event.kind === "scroll" && previousEvent?.kind === "scroll") {
        pendingEvents[pendingEvents.length - 1] = event;
      } else if (event.kind === "input" && previousEvent?.kind === "input" && previousEvent.selector === event.selector) {
        pendingEvents[pendingEvents.length - 1] = event;
      } else {
        pendingEvents.push(event);
      }
      pendingEvents = pendingEvents.slice(-120);
      queue({}, immediate);
    };
    const queue = (payload: Record<string, unknown>, immediate = false) => {
      if (stopping.current) return;
      pending = { ...pending, ...payload };
      if (immediate) {
        if (timer !== null) window.clearTimeout(timer);
        timer = null;
        void drain();
      } else if (timer === null) {
        timer = window.setTimeout(() => { timer = null; void drain(); }, 80);
      }
    };
    queue({ sync: true }, true);
    const heartbeat = window.setInterval(() => queue({ sync: true }, true), 10_000);
    const locationWatcher = window.setInterval(() => {
      const current = `${window.location.pathname}${window.location.search}`;
      if (current === lastKnownLocation) return;
      lastKnownLocation = current;
      queue({ pathname: window.location.pathname, search: window.location.search }, true);
    }, 400);

    const onPointer = (event: PointerEvent) => {
      const now = performance.now();
      if (now - lastPointerSent < 120) return;
      lastPointerSent = now;
      queue({ pointer: { x: event.clientX / Math.max(1, window.innerWidth), y: event.clientY / Math.max(1, window.innerHeight) } });
    };
    const onInput = (event: Event) => {
      const field = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (!field || !["INPUT", "TEXTAREA", "SELECT"].includes(field.tagName) || (field instanceof HTMLInputElement && ["password", "file"].includes(field.type))) return;
      queueEvent({
        kind: "input",
        selector: selectorFor(field),
        value: field.value,
        checked: field instanceof HTMLInputElement && ["checkbox", "radio"].includes(field.type) ? field.checked : undefined,
        fieldTag: field.tagName.toLowerCase(),
        fieldType: field instanceof HTMLInputElement ? field.type : undefined,
      });
    };
    const onScroll = () => {
      const maxX = Math.max(1, document.documentElement.scrollWidth - window.innerWidth);
      const maxY = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      queueEvent({ kind: "scroll", x: window.scrollX / maxX, y: window.scrollY / maxY });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!["Enter", "Escape", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const target = event.target as Element | null;
      if (!target || !(target instanceof HTMLElement)) return;
      queueEvent({
        kind: "key",
        selector: selectorFor(target),
        key: event.key,
        code: event.code,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      }, true);
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest("[data-remote-stop],[data-remote-worker-choice]")) return;
      const actionable = target?.closest("button,a,[role='button'],label,input,textarea,select") || target;
      const click = {
        x: event.clientX / Math.max(1, window.innerWidth),
        y: event.clientY / Math.max(1, window.innerHeight),
        selector: actionable ? selectorFor(actionable) : "",
        label: normalizedLabel(actionable),
        tag: actionable?.tagName.toLowerCase() || "",
      };
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin) {
        queueEvent({ kind: "click", ...click }, true);
        return;
      }
      const next = new URL(anchor.href);
      if (!["/appointments", "/service-forms", "/orders", "/client-control"].some((path) => next.pathname === path || next.pathname.startsWith(`${path}/`))) {
        queueEvent({ kind: "click", ...click }, true);
        return;
      }
      next.searchParams.set("remoteTarget", targetCode);
      event.preventDefault();
      // The pathname itself represents an internal-link click. Replaying the
      // old anchor after the PC reaches the new page would consume the event on
      // the wrong screen.
      pending = { ...pending, pathname: next.pathname, search: next.search };
      pendingEvents = [];
      void drain().then(() => router.push(`${next.pathname}${next.search}${next.hash}`));
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.clearInterval(heartbeat);
      window.clearInterval(locationWatcher);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pcMode, router]);

  if (pcMode && reconnectRequest && !pcSession) {
    return (
      <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/55 p-5 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-[28px] border border-fuchsia-200 bg-white p-7 text-center shadow-2xl">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-fuchsia-100 text-fuchsia-700"><Link2 className="size-7" /></span>
          <h2 className="mt-5 text-2xl font-black text-neutral-950">Ricollega questo dispositivo</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-neutral-500">{reconnectRequest.requestedBy} chiede di ricollegare il tablet a Paradise personale.</p>
          <button type="button" onClick={() => void acknowledgeReconnect()} disabled={reconnecting} className="mt-6 min-h-12 w-full rounded-2xl bg-neutral-950 px-5 text-sm font-black uppercase tracking-wider text-white disabled:opacity-50">
            {reconnecting ? "Ricollegamento…" : "Ricollega ora"}
          </button>
        </div>
      </div>
    );
  }

  if (pcMode && pcSession) {
    const x = `${(pcSession.pointer?.x || 0.5) * 100}vw`;
    const y = `${(pcSession.pointer?.y || 0.25) * 100}vh`;
    return (
      <>
        <div data-remote-status className="pointer-events-none fixed right-5 top-16 z-[9998] inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/95 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-emerald-800 shadow-sm backdrop-blur">
          <span className="size-2 rounded-full bg-emerald-500" />Attivo
        </div>
        {pcSession.mode !== "observe" && pcSession.pointer ? (
          <div className="pointer-events-none fixed z-[9999] transition-[left,top] duration-75 ease-out" style={{ left: x, top: y }}>
            <MousePointer2 className="size-8 -translate-x-1 -translate-y-1 fill-[#F12D83] text-white drop-shadow-[0_3px_4px_rgba(0,0,0,0.55)]" />
            <span className="ml-5 -mt-1 block whitespace-nowrap rounded-full bg-[#F12D83] px-2.5 py-1 text-[10px] font-black text-white shadow-lg">{pcSession.controllerName}</span>
          </div>
        ) : null}
        {pcSession.mode !== "observe" && pcSession.click ? (
          <span
            key={pcSession.click.revision}
            className="pointer-events-none fixed z-[9997] size-12 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-4 border-[#F12D83]"
            style={{ left: `${pcSession.click.x * 100}vw`, top: `${pcSession.click.y * 100}vh` }}
          />
        ) : null}
      </>
    );
  }

  if (pcMode) {
    return (
      <div data-remote-status className="pointer-events-none fixed right-5 top-16 z-[9998] inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white/95 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-red-700 shadow-sm backdrop-blur">
        <span className="size-2 rounded-full bg-red-500" />Stop
      </div>
    );
  }

  if (!pcMode && controllerTarget) {
    const targetCode = controllerTarget;
      const stop = async () => {
        stopping.current = true;
        await fetch("/api/remote-control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stop", targetCode }) });
        router.push("/remote");
      };
      return (
        <div className="fixed bottom-5 right-5 z-[9999] flex items-center gap-3 rounded-2xl border border-fuchsia-300/30 bg-neutral-950 px-4 py-3 text-white shadow-2xl">
          <Radio className="size-4 animate-pulse text-fuchsia-400" /><span className="text-[11px] font-black uppercase tracking-wider">Remoto attivo</span>
          <button type="button" data-remote-stop onClick={() => void stop()} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-white/10 px-3 text-[10px] font-black uppercase tracking-wider hover:bg-white/20" aria-label="Abbandona controllo remoto"><X className="size-4" /> Abbandona</button>
        </div>
      );
  }
  return null;
}
