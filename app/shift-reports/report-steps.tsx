"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Clock3, Users, X } from "lucide-react";

type Answer = "yes" | "no" | null;

export type ScheduledWorker = {
  id: string;
  name: string;
  photoUrl: string | null;
  initials: string;
  shiftTime: string;
};

type WorkerAnswers = { arrived: Answer; arrivalTime: string; presentable: Answer; stationsOrdered: Answer };

function isAnswered(value: Answer | undefined) {
  return value === "yes" || value === "no";
}

function hasArrivalAnswer(value: WorkerAnswers | undefined) {
  return value?.arrived === "yes" || (value?.arrived === "no" && /^\d{2}:\d{2}$/.test(value.arrivalTime));
}

function AnswerButton({ answer, current, label, onClick }: { answer: Exclude<Answer, null>; current: Answer; label: string; onClick: () => void }) {
  const selected = current === answer;
  const positive = answer === "yes";
  return <button type="button" onClick={onClick} aria-pressed={selected} className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border px-5 text-sm font-black transition-all active:scale-[0.98] ${selected ? positive ? "border-[#71c4a4] bg-[#e8f8f1] text-[#147554] shadow-[0_8px_20px_rgba(20,117,84,0.12)]" : "border-[#ec8c9e] bg-[#fff0f3] text-[#be3451] shadow-[0_8px_20px_rgba(190,52,81,0.12)]" : "border-black/10 bg-white/75 text-[#3a3a3c] hover:border-[#e5a4c5] hover:bg-white"}`}>
    {positive ? <Check className="size-4" strokeWidth={3} /> : <X className="size-4" strokeWidth={3} />}{label}
  </button>;
}

function QuestionCard({ number, title, answer, onAnswer }: { number: number; title: string; answer: Answer; onAnswer: (answer: Exclude<Answer, null>) => void }) {
  return <section className="rounded-[26px] border border-white/90 bg-white/70 p-5 shadow-[0_14px_38px_rgba(104,62,79,0.07)] backdrop-blur-xl sm:p-6">
    <div className="flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#ffe2f1] text-xs font-black text-[#aa527c]">{number}</span><h2 className="text-lg font-black tracking-[-0.025em] text-[#1d1d1f] sm:text-xl">{title}</h2></div>
    <div className="mt-5 flex gap-3"><AnswerButton answer="yes" current={answer} label="Sì" onClick={() => onAnswer("yes")} /><AnswerButton answer="no" current={answer} label="No" onClick={() => onAnswer("no")} /></div>
  </section>;
}

function WorkerPhoto({ worker, size = "large" }: { worker: ScheduledWorker; size?: "small" | "large" }) {
  const sizing = size === "large" ? "size-16 sm:size-[72px]" : "size-11";
  return <div className={`grid ${sizing} shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-[#d96f9e] to-[#e999bd] font-black text-white shadow-sm`}>
    {worker.photoUrl ? <img src={worker.photoUrl} alt={`Foto di ${worker.name}`} className="h-full w-full object-cover" /> : worker.initials}
  </div>;
}

export function ReportSteps({ workers = [] }: { workers?: ScheduledWorker[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, WorkerAnswers>>({});

  if (workers.length === 0) return <section className="mt-5 rounded-[26px] border border-white/90 bg-white/70 p-8 text-center shadow-[0_14px_38px_rgba(104,62,79,0.07)] backdrop-blur-xl">
    <Users className="mx-auto size-8 text-[#c36c96]" /><h2 className="mt-3 text-lg font-black text-[#1d1d1f]">Nessun lavoratore previsto oggi</h2><p className="mt-1 text-sm font-medium text-[#6e6e73]">Il planning non contiene turni di lavoro per questa sede.</p>
  </section>;

  const worker = workers[currentIndex];
  const currentAnswers = answers[worker.id] || { arrived: null, arrivalTime: "", presentable: null, stationsOrdered: null };
  const completed = workers.filter((item) => hasArrivalAnswer(answers[item.id]) && isAnswered(answers[item.id]?.presentable) && isAnswered(answers[item.id]?.stationsOrdered)).length;
  const updateAnswers = (changes: Partial<WorkerAnswers>) => setAnswers((current) => ({
    ...current,
    [worker.id]: { ...(current[worker.id] || { arrived: null, arrivalTime: "", presentable: null, stationsOrdered: null }), ...changes },
  }));

  return <div className="mt-5 grid gap-4">
    <section className="rounded-[26px] border border-white/90 bg-white/60 p-4 shadow-[0_14px_38px_rgba(104,62,79,0.06)] backdrop-blur-xl sm:p-5">
      <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#a45a7d]">Lavoratori in turno</p><p className="mt-1 text-sm font-bold text-[#5f5f64]">{workers.length} previsti · {completed} completati</p></div><span className="rounded-full bg-[#ffe2f1] px-3 py-1.5 text-xs font-black text-[#a34f78]">{currentIndex + 1} di {workers.length}</span></div>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">{workers.map((item, index) => {
        const done = hasArrivalAnswer(answers[item.id]) && isAnswered(answers[item.id]?.presentable) && isAnswered(answers[item.id]?.stationsOrdered);
        return <button key={item.id} type="button" onClick={() => setCurrentIndex(index)} className={`relative rounded-full p-0.5 transition ${index === currentIndex ? "ring-2 ring-[#d75f99] ring-offset-2" : "opacity-70 hover:opacity-100"}`} aria-label={`Apri report di ${item.name}`}><WorkerPhoto worker={item} size="small" />{done && <span className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-[#26a878] text-white ring-2 ring-white"><Check className="size-2.5" strokeWidth={4} /></span>}</button>;
      })}</div>
    </section>
    <section className="flex items-center gap-4 rounded-[26px] border border-white/90 bg-[linear-gradient(105deg,rgba(255,225,242,0.88),rgba(255,250,247,0.9))] p-4 shadow-[0_14px_38px_rgba(104,62,79,0.07)] backdrop-blur-xl sm:p-5"><WorkerPhoto worker={worker} /><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#a45a7d]">Lavoratore</p><h2 className="mt-1 truncate text-xl font-black tracking-[-0.03em] text-[#1d1d1f]">{worker.name}</h2><p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-[#6e6e73]"><Clock3 className="size-3.5" /> Turno {worker.shiftTime}</p></div></section>
    <div className="relative grid gap-4 before:absolute before:bottom-8 before:left-9 before:top-8 before:w-px before:bg-gradient-to-b before:from-[#dc6da3] before:via-[#efb8d2] before:to-[#f7dbe8]">
      <div className="relative"><QuestionCard number={1} title="È arrivato puntuale?" answer={currentAnswers.arrived} onAnswer={(value) => updateAnswers({ arrived: value, ...(value === "yes" ? { arrivalTime: "" } : {}) })} /></div>
      {currentAnswers.arrived === "no" && <section className="relative ml-5 animate-in fade-in slide-in-from-bottom-2 rounded-[26px] border border-[#f0bdd3] bg-[#fff6fa]/95 p-5 shadow-[0_14px_38px_rgba(104,62,79,0.07)] duration-300 sm:p-6">
        <label htmlFor={`arrival-time-${worker.id}`} className="flex items-center gap-3 text-base font-black text-[#1d1d1f]"><span className="grid size-9 place-items-center rounded-full bg-[#ffe2f1] text-[#b64f80]"><Clock3 className="size-4" /></span>A che ora è arrivato?</label>
        <input id={`arrival-time-${worker.id}`} type="time" value={currentAnswers.arrivalTime} onChange={(event) => updateAnswers({ arrivalTime: event.target.value })} className="mt-4 min-h-14 w-full rounded-2xl border border-[#e9a9c7] bg-white px-5 text-center text-xl font-black tracking-[0.08em] text-[#1d1d1f] outline-none transition focus:border-[#cb5e94] focus:ring-4 focus:ring-[#f7cce1]" />
        <p className="mt-2 text-center text-xs font-semibold text-[#77777c]">Seleziona l’orario effettivo di ingresso</p>
      </section>}
      {hasArrivalAnswer(currentAnswers) && <div className="relative animate-in fade-in slide-in-from-bottom-2 duration-300"><QuestionCard number={2} title="È presentabile?" answer={currentAnswers.presentable} onAnswer={(value) => updateAnswers({ presentable: value })} /></div>}
      {isAnswered(currentAnswers.presentable) && <div className="relative animate-in fade-in slide-in-from-bottom-2 duration-300"><QuestionCard number={3} title="Le postazioni sono in ordine?" answer={currentAnswers.stationsOrdered} onAnswer={(value) => updateAnswers({ stationsOrdered: value })} /></div>}
    </div>
    <div className="flex items-center justify-between gap-3"><button type="button" onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))} disabled={currentIndex === 0} className="flex min-h-11 items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-4 text-sm font-black text-[#4a4a4f] disabled:cursor-not-allowed disabled:opacity-35"><ChevronLeft className="size-4" /> Indietro</button>{currentIndex < workers.length - 1 && hasArrivalAnswer(currentAnswers) && isAnswered(currentAnswers.presentable) && isAnswered(currentAnswers.stationsOrdered) && <button type="button" onClick={() => setCurrentIndex((value) => Math.min(workers.length - 1, value + 1))} className="flex min-h-11 items-center gap-2 rounded-2xl bg-[#1d1d1f] px-5 text-sm font-black text-white shadow-lg transition active:scale-[0.98]">Prossimo lavoratore <ChevronRight className="size-4" /></button>}</div>
  </div>;
}
