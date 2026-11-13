import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { archiveMonths } from "@/lib/appointment-archive-range";

type AgendaView = "day" | "week" | "month";
type AgendaLayout = "board" | "table";
type FilterOption = { value: string; label: string };

type RepubblicaAgendaToolbarProps = {
  title: string;
  visitCount: number;
  dateLabel: string;
  dateFrom: string;
  dateTo: string;
  view: AgendaView;
  layoutMode: AgendaLayout;
  dateOpen: boolean;
  onDateOpenChange: (open: boolean) => void;
  onDateRangeChange: (from: string, to: string) => void;
  onArchiveMonth: (month: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: AgendaView) => void;
  onLayoutChange: (layout: AgendaLayout) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  searchOpen: boolean;
  onSearchToggle: () => void;
  searchField: ReactNode;
  workerValue: string;
  workerOptions: FilterOption[];
  onWorkerChange: (value: string) => void;
  statusValue: string;
  statusOptions: FilterOption[];
  onStatusChange: (value: string) => void;
  canReset: boolean;
  onReset: () => void;
  hideOffShift: boolean;
  onHideOffShiftChange: (hide: boolean) => void;
  offShiftHint?: string;
  hours: Array<{ value: string; count: number }>;
  totalHoursCount: number;
  hourValue: string;
  onHourChange: (value: string) => void;
  onGeneratePcLink?: () => void;
  advancedFilters?: ReactNode;
  onAdvancedOpenChange?: (open: boolean) => void;
};

const toolbarTheme = [
  "[--agenda-surface:#fff] [--agenda-border:#dfd7da] [--agenda-divider:#ece5e8] [--agenda-text:#2b2429] [--agenda-muted:#6d6067]",
  "[--agenda-hover:#faf4f6] [--agenda-focus:#9f3f5b] [--agenda-disabled:#766f73]",
  "[--agenda-accent:#28594b] [--agenda-accent-border:#d6e3de] [--agenda-accent-surface:#e4eee9]",
  "[--agenda-hour-selected:#600d19] [--agenda-hour-selected-text:#fff] [--agenda-count:#f3edef] [--agenda-count-text:#694a56]",
  "dark:[color-scheme:dark] dark:[--agenda-surface:#1c1d20] dark:[--agenda-border:#414247] dark:[--agenda-divider:#343539] dark:[--agenda-text:#f4f1f0] dark:[--agenda-muted:#bfb7bb]",
  "dark:[--agenda-hover:#2a2b30] dark:[--agenda-focus:#abd6c0] dark:[--agenda-disabled:#a59da2]",
  "dark:[--agenda-accent:#bde1cf] dark:[--agenda-accent-border:#456154] dark:[--agenda-accent-surface:#2d4439]",
  "dark:[--agenda-hour-selected:#add3bd] dark:[--agenda-hour-selected-text:#162b21] dark:[--agenda-count:#343c37] dark:[--agenda-count-text:#d4e6da]",
].join(" ");
const toolbarSurface = "border-[color:var(--agenda-border)] bg-[color:var(--agenda-surface)]";
const focusClass = "outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--agenda-focus)]";
const controlClass = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold text-[color:var(--agenda-text)] transition-colors hover:bg-[color:var(--agenda-hover)] disabled:cursor-default disabled:border-[color:var(--agenda-divider)] disabled:text-[color:var(--agenda-disabled)] disabled:hover:bg-[color:var(--agenda-surface)] ${toolbarSurface} ${focusClass}`;
const inputClass = `min-h-11 min-w-0 rounded-xl border px-3 text-sm font-semibold text-[color:var(--agenda-text)] ${toolbarSurface} ${focusClass}`;
const labelClass = "grid min-w-0 flex-1 gap-1 text-xs font-semibold text-[color:var(--agenda-muted)]";

function DateRangeControls({
  from,
  to,
  onApply,
  onArchiveMonth,
}: {
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
  onArchiveMonth: (month: string) => void;
}) {
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [archiveMonth, setArchiveMonth] = useState(from.slice(0, 7));
  const fromInput = useRef<HTMLInputElement>(null);
  let rangeError = "";
  if (draftFrom && draftTo) {
    try { archiveMonths(draftFrom, draftTo); }
    catch (error) { rangeError = error instanceof Error ? error.message : "Periodo non valido"; }
  }
  const validRange = Boolean(draftFrom && draftTo && !rangeError);

  useEffect(() => {
    fromInput.current?.focus();
  }, []);

  return (
    <div className={`grid gap-4 rounded-xl border p-3 shadow-lg sm:p-4 ${toolbarSurface}`}>
      <div className="grid gap-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className={labelClass}>
            Dal
            <input ref={fromInput} type="date" className={`${inputClass} w-full`} value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} />
          </label>
          <label className={labelClass}>
            Al
            <input type="date" className={`${inputClass} w-full`} value={draftTo} onChange={(event) => setDraftTo(event.target.value)} />
          </label>
        </div>
        {rangeError ? <p role="status" className="text-xs font-medium text-red-700 dark:text-red-300">{rangeError}</p> : null}
        <button type="button" className={controlClass} disabled={!validRange} onClick={() => onApply(draftFrom, draftTo)}>
          Applica periodo
        </button>
      </div>
      <div className="grid gap-2 border-t border-[color:var(--agenda-divider)] pt-3">
        <label className={labelClass}>
          Mese dello storico
          <input type="month" className={`${inputClass} w-full`} value={archiveMonth} onChange={(event) => setArchiveMonth(event.target.value)} />
        </label>
        <button type="button" className={controlClass} disabled={!archiveMonth} onClick={() => onArchiveMonth(archiveMonth)}>
          Apri archivio
        </button>
      </div>
    </div>
  );
}

export function RepubblicaAgendaToolbar({
  title,
  visitCount,
  dateLabel,
  dateFrom,
  dateTo,
  view,
  layoutMode,
  dateOpen,
  onDateOpenChange,
  onDateRangeChange,
  onArchiveMonth,
  onPrevious,
  onNext,
  onToday,
  onViewChange,
  onLayoutChange,
  isRefreshing,
  onRefresh,
  searchOpen,
  onSearchToggle,
  searchField,
  workerValue,
  workerOptions,
  onWorkerChange,
  statusValue,
  statusOptions,
  onStatusChange,
  canReset,
  onReset,
  hideOffShift,
  onHideOffShiftChange,
  offShiftHint,
  hours,
  totalHoursCount,
  hourValue,
  onHourChange,
  onGeneratePcLink,
  advancedFilters,
  onAdvancedOpenChange,
}: RepubblicaAgendaToolbarProps) {
  const dateControl = useRef<HTMLDivElement>(null);
  const dateButton = useRef<HTMLButtonElement>(null);
  const datePanelId = useId();
  const extraButton = useRef<HTMLElement>(null);
  const hoursLabelId = useId();
  const extraMenu = useRef<HTMLDetailsElement>(null);
  const hourChoices = [{ value: "", count: totalHoursCount }, ...hours];

  function closeExtras() {
    if (extraMenu.current) extraMenu.current.open = false;
  }

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (extraMenu.current?.open && event.target instanceof Node && !extraMenu.current.contains(event.target)) {
        extraMenu.current.open = false;
      }
    }
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && extraMenu.current?.open) {
        extraMenu.current.open = false;
        extraButton.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  useEffect(() => {
    if (!dateOpen) return;

    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !dateControl.current?.contains(event.target)) {
        onDateOpenChange(false);
      }
    }

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      onDateOpenChange(false);
      dateButton.current?.focus();
    }

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [dateOpen, onDateOpenChange]);

  function closeDate() {
    onDateOpenChange(false);
    dateButton.current?.focus();
  }

  return (
    <section className={`repubblica-agenda-toolbar relative z-20 min-w-0 rounded-2xl border border-[color:var(--agenda-border)] p-3.5 sm:rounded-[22px] sm:p-5 lg:px-6 ${toolbarTheme}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.045em] text-[color:var(--agenda-text)] sm:text-[2rem]">
            {title}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm font-medium text-[color:var(--agenda-muted)]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--agenda-accent-surface)] px-2.5 py-1 text-xs font-semibold text-[color:var(--agenda-accent)]">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" /> Repubblica
            </span>
            <span><strong className="font-semibold tabular-nums text-[color:var(--agenda-text)]">{visitCount}</strong> {visitCount === 1 ? "visita" : "visite"} in agenda</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`${controlClass} min-w-11 px-0`}
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label={isRefreshing ? "Sincronizzazione in corso" : "Sincronizza agenda"}
            title={isRefreshing ? "Sincronizzazione in corso" : "Sincronizza agenda"}
          >
            <RefreshCw aria-hidden="true" className={`size-4 ${isRefreshing ? "animate-spin motion-reduce:animate-none" : ""}`} />
          </button>
          <button
            type="button"
            className={controlClass}
            aria-controls="appointments-search-panel"
            aria-expanded={searchOpen}
            onClick={onSearchToggle}
          >
            {searchOpen ? <X aria-hidden="true" className="size-4" /> : <Search aria-hidden="true" className="size-4" />}
            {searchOpen ? "Chiudi ricerca" : "Cerca"}
          </button>
          <details ref={extraMenu} className="sm:relative" onToggle={(event) => onAdvancedOpenChange?.(event.currentTarget.open)}>
            <summary
              ref={extraButton}
              className={`${controlClass} min-w-11 cursor-pointer list-none px-0 [&::-webkit-details-marker]:hidden`}
              aria-label="Altre opzioni agenda"
              title="Altre opzioni agenda"
            >
              <Ellipsis aria-hidden="true" className="size-5" />
            </summary>
            <div className={`absolute left-3 right-3 z-40 mt-2 grid gap-3 rounded-xl border p-3 shadow-lg sm:left-auto sm:right-0 sm:top-full sm:w-64 ${toolbarSurface}`}>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Vista appuntamenti">
                <button type="button" aria-pressed={layoutMode === "board"} className={`${controlClass} aria-pressed:bg-[color:var(--agenda-accent-surface)]`} onClick={() => { closeExtras(); onLayoutChange("board"); }}>
                  <LayoutGrid aria-hidden="true" className="size-4" /> Board
                </button>
                <button type="button" aria-pressed={layoutMode === "table"} className={`${controlClass} aria-pressed:bg-[color:var(--agenda-accent-surface)]`} onClick={() => { closeExtras(); onLayoutChange("table"); }}>
                  <List aria-hidden="true" className="size-4" /> Tabella
                </button>
              </div>
              {advancedFilters}
              {onGeneratePcLink ? (
                <button
                  type="button"
                  className={controlClass}
                  onClick={() => {
                    closeExtras();
                    onGeneratePcLink();
                  }}
                >
                  Genera link PC Cassa
                </button>
              ) : null}
            </div>
          </details>
        </div>
      </div>

      <div id="appointments-search-panel" hidden={!searchOpen} className="mt-4 max-w-lg">
        {searchField}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Periodo appuntamenti">
        <div className="relative flex w-full items-center gap-2 sm:w-auto" ref={dateControl}>
          <button type="button" className={`${controlClass} min-w-11 px-0`} onClick={() => { onDateOpenChange(false); onPrevious(); }} aria-label="Periodo precedente" title="Periodo precedente">
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <button
            ref={dateButton}
            type="button"
            className={`${controlClass} min-w-0 flex-1 justify-start tabular-nums sm:min-w-40 sm:flex-none`}
            aria-label={`Cambia periodo, ${dateLabel}`}
            aria-expanded={dateOpen}
            aria-haspopup="dialog"
            aria-controls={dateOpen ? datePanelId : undefined}
            onClick={() => onDateOpenChange(!dateOpen)}
          >
            <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-[color:var(--agenda-muted)]" />
            <span className="truncate">{dateLabel}</span>
          </button>
          <button type="button" className={`${controlClass} min-w-11 px-0`} onClick={() => { onDateOpenChange(false); onNext(); }} aria-label="Periodo successivo" title="Periodo successivo">
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>

          {dateOpen ? (
            <div id={datePanelId} role="dialog" aria-label="Scegli il periodo" className="absolute left-0 top-full z-30 mt-2 w-full sm:w-80">
              <DateRangeControls
                key={`${dateFrom}:${dateTo}`}
                from={dateFrom}
                to={dateTo}
                onApply={(from, to) => {
                  closeDate();
                  onDateRangeChange(from, to);
                }}
                onArchiveMonth={(month) => {
                  closeDate();
                  onArchiveMonth(month);
                }}
              />
            </div>
          ) : null}
        </div>
        <button type="button" className={controlClass} onClick={onToday}>Oggi</button>
        <select aria-label="Ampiezza del periodo" className={inputClass} value={view} onChange={(event) => onViewChange(event.target.value as AgendaView)}>
          <option value="day">Giorno</option>
          <option value="week">Settimana</option>
          <option value="month">Mese</option>
        </select>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-2">
        <label className={`${labelClass} basis-32 sm:max-w-56`}>
          Lavoratrice
          <select className={`${inputClass} w-full`} value={workerValue} onChange={(event) => onWorkerChange(event.target.value)}>
            <option value="all">Tutte le lavoratrici</option>
            {workerOptions.filter((option) => option.value !== "all").map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className={`${labelClass} basis-32 sm:max-w-44`}>
          Stato
          <select className={`${inputClass} w-full`} value={statusValue} onChange={(event) => onStatusChange(event.target.value)}>
            <option value="all">Tutti gli stati</option>
            {statusOptions.filter((option) => option.value !== "all").map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <button type="button" className={`${controlClass} !border-transparent !bg-transparent enabled:hover:!border-[color:var(--agenda-divider)] enabled:hover:!bg-[color:var(--agenda-hover)]`} disabled={!canReset} onClick={onReset}>Azzera filtri</button>
        {layoutMode === "board" ? <button
          type="button"
          title={offShiftHint}
          data-active={hideOffShift}
          className={`${controlClass} data-[active=true]:border-[color:var(--agenda-accent-border)] data-[active=true]:text-[color:var(--agenda-accent)] data-[active=true]:hover:bg-[color:var(--agenda-accent-surface)] data-[active=true]:bg-[color:var(--agenda-accent-surface)]`}
          onClick={() => onHideOffShiftChange(!hideOffShift)}
        >
          {hideOffShift ? "Mostra fuori turno" : "Nascondi fuori turno"}
        </button> : null}
      </div>

      <div className="mt-5 border-t border-[color:var(--agenda-divider)] pt-4 sm:mt-6">
        <div className="flex items-center gap-2">
          <SlidersHorizontal aria-hidden="true" className="size-4 text-[color:var(--agenda-muted)]" />
          <h2 id={hoursLabelId} className="text-sm font-semibold text-[color:var(--agenda-text)]">Ora di inizio</h2>
          <span className="text-xs font-medium text-[color:var(--agenda-muted)]">Roma</span>
        </div>
        <div role="group" aria-labelledby={hoursLabelId} className="mt-3 flex flex-wrap gap-2">
          {hourChoices.map(({ value, count }) => {
            const selected = value === hourValue;
            const label = value ? `${value}:00` : "Tutti";
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                className={`${controlClass} !rounded-full tabular-nums aria-pressed:border-[color:var(--agenda-hour-selected)] aria-pressed:bg-[color:var(--agenda-hour-selected)] aria-pressed:text-[color:var(--agenda-hour-selected-text)]`}
                onClick={() => onHourChange(value)}
              >
                <span>{label}</span>
                <span className={`grid min-w-5 place-items-center rounded-full px-1.5 py-0.5 text-xs ${selected ? "bg-[color:var(--agenda-hour-selected-text)] text-[color:var(--agenda-hour-selected)]" : "bg-[color:var(--agenda-count)] text-[color:var(--agenda-count-text)]"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
