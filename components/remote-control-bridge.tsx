"use client";

import { useEffect, useRef, useState } from "react";
import { MousePointer2, Radio, X } from "lucide-react";

type RemoteSession = {
  controllerName: string;
  workerId: string | null;
  pathname: string;
  search: string;
  pointer: { x: number; y: number; revision: number } | null;
  input: { selector: string; value: string; revision: number } | null;
  click: { x: number; y: number; revision: number } | null;
  scroll: { x: number; y: number; revision: number } | null;
};

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

export function RemoteControlBridge({ pcMode = false }: { pcMode?: boolean }) {
  const [pcSession, setPcSession] = useState<RemoteSession | null>(null);
  const [controllerTarget, setControllerTarget] = useState("");
  const lastInputRevision = useRef(0);
  const lastPath = useRef("");
  const lastScrollRevision = useRef(0);
  const stopping = useRef(false);

  useEffect(() => {
    if (!pcMode) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch("/api/remote-control", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        const remote = (data?.session || null) as RemoteSession | null;
        if (cancelled) return;
        setPcSession(remote);
        if (!remote) return;

        if (remote.scroll && remote.scroll.revision > lastScrollRevision.current) {
          lastScrollRevision.current = remote.scroll.revision;
          const maxX = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
          const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
          window.scrollTo({ left: remote.scroll.x * maxX, top: remote.scroll.y * maxY, behavior: "smooth" });
        }

        if (remote.input && remote.input.revision > lastInputRevision.current) {
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

        const params = new URLSearchParams(remote.search || "");
        params.delete("remoteTarget");
        const salone = params.get("salone") || "buenos-aires";
        let targetPath = remote.pathname;
        if (targetPath === "/appointments") targetPath = `/appointments/${salone}`;
        const cleanSearch = params.toString();
        const wanted = `${targetPath}${cleanSearch ? `?${cleanSearch}` : ""}`;
        const here = `${window.location.pathname}${window.location.search}`;
        if (wanted !== here && wanted !== lastPath.current) {
          lastPath.current = wanted;
          window.location.assign(wanted);
        }
      } catch {
        // A temporary network failure must not interrupt the cashier screen.
      }
    };
    void poll();
    const interval = window.setInterval(poll, 700);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [pcMode]);

  useEffect(() => {
    if (pcMode) return;
    const targetCode = new URLSearchParams(window.location.search).get("remoteTarget");
    if (!targetCode) return;
    setControllerTarget(targetCode);
    let lastPointerSent = 0;
    let lastScrollSent = 0;

    const send = (payload: Record<string, unknown>) => {
      if (stopping.current) return;
      void fetch("/api/remote-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", targetCode, pathname: window.location.pathname, search: window.location.search, ...payload }),
        keepalive: true,
      });
    };
    send({});

    const onPointer = (event: PointerEvent) => {
      const now = Date.now();
      if (now - lastPointerSent < 250) return;
      lastPointerSent = now;
      send({ pointer: { x: event.clientX / Math.max(1, window.innerWidth), y: event.clientY / Math.max(1, window.innerHeight) } });
    };
    const onInput = (event: Event) => {
      const field = event.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (!field || !["INPUT", "TEXTAREA"].includes(field.tagName) || field.type === "password" || field.type === "file") return;
      send({ input: { selector: selectorFor(field), value: field.value } });
    };
    const onScroll = () => {
      const now = Date.now();
      if (now - lastScrollSent < 250) return;
      lastScrollSent = now;
      const maxX = Math.max(1, document.documentElement.scrollWidth - window.innerWidth);
      const maxY = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      send({ scroll: { x: window.scrollX / maxX, y: window.scrollY / maxY } });
    };
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest("[data-remote-stop]")) return;
      send({ click: { x: event.clientX / Math.max(1, window.innerWidth), y: event.clientY / Math.max(1, window.innerHeight) } });
      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
      const next = new URL(anchor.href);
      if (!["/appointments", "/service-forms", "/orders", "/client-control"].some((path) => next.pathname === path || next.pathname.startsWith(`${path}/`))) return;
      next.searchParams.set("remoteTarget", targetCode);
      event.preventDefault();
      window.location.assign(`${next.pathname}${next.search}${next.hash}`);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("input", onInput, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pcMode]);

  if (pcMode && pcSession) {
    const x = `${(pcSession.pointer?.x || 0.5) * 100}vw`;
    const y = `${(pcSession.pointer?.y || 0.25) * 100}vh`;
    return (
      <>
        <div className="pointer-events-none fixed left-1/2 top-3 z-[9998] -translate-x-1/2 rounded-full border border-fuchsia-200 bg-neutral-950/90 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-2xl backdrop-blur">
          <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-fuchsia-400" />Controllo remoto attivo · {pcSession.controllerName}
        </div>
        {pcSession.pointer ? (
          <div className="pointer-events-none fixed z-[9999] transition-[left,top] duration-200 ease-out" style={{ left: x, top: y }}>
            <MousePointer2 className="size-8 -translate-x-1 -translate-y-1 fill-[#F12D83] text-white drop-shadow-[0_3px_4px_rgba(0,0,0,0.55)]" />
            <span className="ml-5 -mt-1 block whitespace-nowrap rounded-full bg-[#F12D83] px-2.5 py-1 text-[10px] font-black text-white shadow-lg">{pcSession.controllerName}</span>
          </div>
        ) : null}
        {pcSession.click ? (
          <span
            key={pcSession.click.revision}
            className="pointer-events-none fixed z-[9997] size-12 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-4 border-[#F12D83]"
            style={{ left: `${pcSession.click.x * 100}vw`, top: `${pcSession.click.y * 100}vh` }}
          />
        ) : null}
      </>
    );
  }

  if (!pcMode && controllerTarget) {
    const targetCode = controllerTarget;
      const stop = async () => {
        stopping.current = true;
        await fetch("/api/remote-control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stop", targetCode }) });
        window.location.href = "/remote";
      };
      return (
        <div className="fixed bottom-5 right-5 z-[9999] flex items-center gap-3 rounded-2xl border border-fuchsia-300/30 bg-neutral-950 px-4 py-3 text-white shadow-2xl">
          <Radio className="size-4 animate-pulse text-fuchsia-400" /><span className="text-[11px] font-black uppercase tracking-wider">Remoto attivo</span>
          <button type="button" data-remote-stop onClick={() => void stop()} className="grid size-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20" aria-label="Termina controllo remoto"><X className="size-4" /></button>
        </div>
      );
  }
  return null;
}
