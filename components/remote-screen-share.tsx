"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MonitorUp } from "lucide-react";

type VideoSignal = {
  requestId: string;
  targetCode: string;
  offer: RTCSessionDescriptionInit;
  status: "requested" | "connecting" | "live" | "denied" | "ended";
};

function waitForIce(peer: RTCPeerConnection, timeoutMs = 5_000) {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(done, timeoutMs);
    function done() {
      window.clearTimeout(timeout);
      peer.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    }
    function onChange() {
      if (peer.iceGatheringState === "complete") done();
    }
    peer.addEventListener("icegatheringstatechange", onChange);
  });
}

export function RemoteScreenShare() {
  const [signal, setSignal] = useState<VideoSignal | null>(null);
  const [starting, setStarting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handledRequestRef = useRef("");

  const stopLocalShare = useCallback((signalToNotify: VideoSignal | null = null) => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    setSharing(false);
    window.sessionStorage.removeItem("paradise-live-video-active");
    if (signalToNotify) {
      void fetch("/api/remote-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", targetCode: signalToNotify.targetCode, requestId: signalToNotify.requestId, status: "ended" }),
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unauthorized = false;
    const poll = async () => {
      if (unauthorized) return;
      const response = await fetch("/api/remote-video?mode=pc", { cache: "no-store" }).catch(() => null);
      if (!response) return;
      if (response.status === 401 || response.status === 403) {
        unauthorized = true;
        return;
      }
      const data = response.ok ? await response.json().catch(() => null) : null;
      if (cancelled) return;
      const nextSignal = (data?.signal || null) as VideoSignal | null;
      if (!nextSignal) {
        if (streamRef.current) stopLocalShare();
        setSignal(null);
        handledRequestRef.current = "";
        return;
      }
      if (nextSignal.requestId !== signal?.requestId) {
        if (streamRef.current) stopLocalShare();
        setSignal(nextSignal);
        setStarting(false);
      } else {
        setSignal(nextSignal);
      }
      if (["denied", "ended"].includes(nextSignal.status) && streamRef.current) stopLocalShare();
    };
    void poll();
    const interval = window.setInterval(poll, 1_200);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [signal?.requestId, stopLocalShare]);

  useEffect(() => () => stopLocalShare(), [stopLocalShare]);

  async function startSharing() {
    if (!signal || starting || sharing || handledRequestRef.current === signal.requestId) return;
    setStarting(true);
    handledRequestRef.current = signal.requestId;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 12, max: 15 } },
        audio: false,
      });
      const peer = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.cloudflare.com:3478" },
          { urls: "stun:stun.l.google.com:19302" },
        ],
      });
      peerRef.current = peer;
      streamRef.current = stream;
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) videoTrack.addEventListener("ended", () => stopLocalShare(signal), { once: true });
      peer.addEventListener("connectionstatechange", () => {
        if (!signal) return;
        if (peer.connectionState === "connected") {
          setSharing(true);
          setStarting(false);
          window.sessionStorage.setItem("paradise-live-video-active", "1");
          void fetch("/api/remote-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "status", targetCode: signal.targetCode, requestId: signal.requestId, status: "live" }),
          });
        } else if (["failed", "closed", "disconnected"].includes(peer.connectionState)) {
          stopLocalShare(peer.connectionState !== "closed" ? signal : null);
        }
      });
      await peer.setRemoteDescription(signal.offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await waitForIce(peer);
      const response = await fetch("/api/remote-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "answer", targetCode: signal.targetCode, requestId: signal.requestId, answer: peer.localDescription }),
      });
      if (!response.ok) throw new Error("Collegamento non riuscito");
    } catch (error) {
      const denied = error instanceof DOMException && ["NotAllowedError", "AbortError"].includes(error.name);
      setStarting(false);
      setSharing(false);
      handledRequestRef.current = "";
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      peerRef.current?.close();
      peerRef.current = null;
      await fetch("/api/remote-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "status",
          targetCode: signal.targetCode,
          requestId: signal.requestId,
          status: denied ? "denied" : "ended",
          message: denied ? "Condivisione non autorizzata." : "Collegamento video non riuscito.",
        }),
      }).catch(() => null);
    }
  }

  if (!signal || sharing || signal.status !== "requested") return null;

  return (
    <div data-remote-private className="fixed bottom-5 right-5 z-[10001] w-[min(340px,calc(100vw-40px))] rounded-2xl border border-emerald-200 bg-white p-4 text-neutral-950 shadow-2xl">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
          <MonitorUp className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black">Avvia video live</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-neutral-500">Condividi questa schermata con l’amministratore.</p>
        </div>
      </div>
      <button type="button" disabled={starting} onClick={() => void startSharing()} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-55">
        {starting ? <><Loader2 className="size-4 animate-spin" /> Attendi…</> : "Condividi schermo"}
      </button>
    </div>
  );
}
