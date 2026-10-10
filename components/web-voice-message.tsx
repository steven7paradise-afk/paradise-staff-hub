"use client";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, LoaderCircle } from "lucide-react";
import s from "./web-chat.module.css";
const clock = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
export function WebVoiceMessage({ src }: { src: string }) {
  const container = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement>(null), loadedWave = useRef(false), mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const [playing, setPlaying] = useState(false), [waiting, setWaiting] = useState(false);
  const [position, setPosition] = useState(0), [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<number[]>([]), [error, setError] = useState("");
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => {
    if (!container.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { void waveform(); observer.disconnect(); } });
    observer.observe(container.current); return () => observer.disconnect();
  }, [src]);
  async function waveform() {
    if (loadedWave.current) return;
    loadedWave.current = true; controller.current = new AbortController();
    let context: AudioContext | undefined;
    try {
      const result = await fetch(src, { signal: controller.current.signal });
      if (!result.ok) return;
      const bytes = await result.arrayBuffer();
      if (!mounted.current) return;
      context = new AudioContext();
      const decoded = await context.decodeAudioData(bytes);
      if (!mounted.current) return;
      const data = decoded.getChannelData(0), bars = 42, step = Math.max(1, Math.floor(data.length / bars));
      const values = Array.from({length: bars}, (_, i) => { let max = 0; for (let n = i * step; n < Math.min(data.length, (i + 1) * step); n += 8) max = Math.max(max, Math.abs(data[n])); return max; });
      const max = Math.max(.01, ...values);
      setPeaks(values.map(v => Math.max(.1, Math.sqrt(v / max))));
      if (Number.isFinite(decoded.duration)) setDuration(decoded.duration);
    } catch { /* Playback remains available if waveform decoding is unsupported. */ }
    finally { if (context) void context.close(); }
  }
  async function toggle() {
    const player = audio.current; if (!player) return;
    if (!player.paused) { player.pause(); return; }
    setError(""); setWaiting(true);
    try { await player.play(); void waveform(); }
    catch { if (mounted.current) { setWaiting(false); setError("Audio non disponibile. Premi Play per riprovare."); } }
  }
  const progress = duration > 0 ? position / duration : 0;
  return <div ref={container} className={s.voiceMessage}>
    <audio ref={audio} src={src} preload="none" onPlay={() => setPlaying(true)} onPlaying={() => setWaiting(false)} onPause={() => { setPlaying(false); setWaiting(false); }} onWaiting={() => setWaiting(true)} onEnded={() => { setPlaying(false); setWaiting(false); setPosition(0); }} onTimeUpdate={() => setPosition(audio.current?.currentTime ?? 0)} onDurationChange={() => { const value = audio.current?.duration; if (value && Number.isFinite(value)) setDuration(value); }} onError={() => { setWaiting(false); setPlaying(false); setError("Audio non disponibile. Riprova."); }}/>
    <div className={s.voiceControls}><button type="button" className={s.voicePlay} aria-label={playing ? "Pausa messaggio vocale" : "Riproduci messaggio vocale"} onClick={() => void toggle()}>{waiting ? <LoaderCircle size={19} className={s.voiceLoading}/> : playing ? <Pause size={19} fill="currentColor"/> : <Play size={19} fill="currentColor"/>}</button>
    <div className={s.waveTrack}><div className={s.waveBars} aria-hidden="true">{Array.from({length:42},(_,i) => <i key={i} style={{height: peaks.length ? `${Math.round(peaks[i] * 28)}px` : "4px", opacity:i / 42 <= progress ? 1 : .4}}/>)}</div><input aria-label="Avanzamento messaggio vocale" type="range" min="0" max={duration || 1} step="0.1" value={Math.min(position,duration || 1)} disabled={!duration} onChange={e => { const value = Number(e.target.value); if (audio.current) { audio.current.currentTime = value; setPosition(value); } }} /></div></div>
    <div className={s.voiceTimes}><span>{clock(position)}</span><span>{duration ? clock(duration) : "Audio"}</span></div>
    {error && <small role="alert" className={s.voiceError}>{error}</small>}
  </div>;
}
