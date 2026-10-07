import { appointmentStaffDisplayName } from './appointment-staff-access';
import { createHash } from 'node:crypto';
import { prisma } from './prisma';
import { getCompleteCowlendarBookingsForRange } from './cowlendar';
import { romeDayRange } from './shift-reports';
import { romeAgendaDate } from './shift-agenda';
import { deriveAttendanceState } from './attendance-state';
import { normalizeAssistanceSheets } from './assistance-tables';
import { isClientControlFormName } from './client-control-form';
import { selectShiftResponsible } from './shift-responsible-selection';
import { shiftDeadline } from './shift-deadline';
import { QUALITY_CAUSES } from './shift-quality';
import { calculateDirectionBonus, emptyBonusMonth, INITIAL_BONUS_NAMES, proposedRules, type BonusRules, type BonusMonthState, type BonusEvent, type BonusIssue } from './direction-bonus';
const text = (v: unknown) => String(v ?? '').trim();
const names = (v: unknown): string[] => Array.isArray(v) ? v.map(text) : text(v).split(/[,;]+/).map(s => s.trim()).filter(Boolean);
const key = (v: unknown) => text(v).toLowerCase().replace(/\s+/g, ' ');
const minutes = (v: string) => { const [h, m] = v.split(':').map(Number); return h * 60 + m; };
const clock = (v: Date) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(v);
export async function loadDirectionBonus(month: string) {
    const today = romeAgendaDate(new Date());
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || month < '2026-09' || month > today.slice(0, 7))
        throw new Error('Scegli un mese da settembre 2026 a oggi');
    const [year, m] = month.split('-').map(Number);
    const last = `${month}-${new Date(Date.UTC(year, m, 0)).getUTCDate()}`;
    const endDay = last < today ? last : today;
    const { start } = romeDayRange(`${month}-01`);
    const { end } = romeDayRange(endDay);
    const [people, settings, forms] = await Promise.all([
        prisma.user.findMany({ select: { id: true, name: true, active: true, mansione: true, role: true, location: { select: { name: true } }, schedule_entries: { where: { date: { gte: new Date(`${month}-01T00:00:00Z`), lte: new Date(`${endDay}T00:00:00Z`) } }, include: { category: true } }, attendance_logs: { where: { timestamp: { gte: start, lt: end } }, orderBy: { timestamp: 'asc' } }, leave_requests: { where: { status: { in: ['PENDING', 'APPROVED'] }, start_date: { lt: end }, end_date: { gte: start } } } }, orderBy: { name: 'asc' } }),
        prisma.setting.findMany({ where: { OR: [{ key: { startsWith: 'direction_' } }, { key: { startsWith: 'shift_' } }, { key: 'assistance_tables' }, { key: 'appointment_status_overrides' }, { key: 'appointment_team_overrides' }, { key: 'weekly_shift_responsibles' }] } }),
        prisma.serviceForm.findMany({ select: { id: true, name: true, category: true } })
    ]);
    const values = new Map(settings.map(s => [s.key, s.value as any]));
    const versions = (values.get('direction_bonus_rules') || []) as BonusRules[];
    const selected = [...versions].filter(r => r.effectiveMonth <= month).sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0];
    const applicable = selected && !(month >= '2026-10' && selected.effectiveMonth < '2026-10') ? selected : undefined;
    const rules = applicable || proposedRules(month, people.filter(p => INITIAL_BONUS_NAMES.some(n => key(n) === key(p.name))).map(p => p.id));
    const state = (values.get(`direction_bonus_month_${month}`) || emptyBonusMonth()) as BonusMonthState;
    const participants = people.filter(p => rules.participants.includes(p.id));
    const events: BonusEvent[] = [];
    const issues: BonusIssue[] = [];
    const daily: any[] = [];
    const calendar: any[] = [];
    const issue = (id: string, kind: string, day: string, label: string, href: string, acknowledge = false) => issues.push({ id, kind, day, label, href, acknowledge });
    if (!applicable)
        issue('rules', 'Impostazioni', endDay, 'Confermare e salvare le regole valide dal mese selezionato', '#regole');
    const responsibilities = new Map<string, string>();
    const matches = (a: unknown, b: unknown) => key(appointmentStaffDisplayName(text(a))) === key(appointmentStaffDisplayName(text(b)));
    for (let d = 1; d <= Number(endDay.slice(8)); d++) {
        const day = `${month}-${String(d).padStart(2, '0')}`;
        const elapsed = Date.now() >= shiftDeadline(day);
        const savedTeam = values.get(`shift_team_${day}`)?.notes;
        const cash = values.get(`shift_cash_${day}`);
        const closure = values.get(`shift_closed_${day}`);
        const dayPeople = people.map(p => { const entry = p.schedule_entries.find(s => s.date.toISOString().slice(0, 10) === day); const logs = p.attendance_logs.filter(l => romeAgendaDate(l.timestamp) === day); const attendance = deriveAttendanceState(logs); const leave = p.leave_requests.find(l => l.status === 'APPROVED' && !l.start_time && !l.end_time && l.start_date.toISOString().slice(0, 10) <= day && l.end_date.toISOString().slice(0, 10) >= day); const working = !!entry && !leave && !/riposo|ferie|malattia|permesso|assenz|chius|non lavor/i.test(entry.category.name); return { p, entry, logs, attendance, leave, working }; });
        const candidates = dayPeople.filter(x => /responsabile salone/i.test(x.p.mansione || '') && /buenos/i.test(x.p.location?.name || ''));
        const responsibleId = selectShiftResponsible(candidates.map(x => ({ id: x.p.id, vice: /vice/i.test(x.p.mansione || ''), resting: /riposo/i.test(x.entry?.category.name || ''), working: x.working, clockedIn: !!x.attendance.firstEntry })), values.get('weekly_shift_responsibles')?.[day]) || candidates.find(x => x.working && !/vice/i.test(x.p.mansione || ''))?.p.id || candidates.find(x => x.working)?.p.id || '';
        responsibilities.set(day, responsibleId);
        const hasData = ['agenda', 'team', 'hair', 'products', 'cash', 'tomorrow', 'client_cases'].some(k => values.has(`shift_${k}_${day}`));
        const responsible = people.find(p => p.id === responsibleId)?.name || 'Da verificare';
        const stateLabel = closure?.closedAt ? (Date.parse(closure.closedAt) <= shiftDeadline(day) ? 'ontime' : 'late') : hasData ? 'incomplete' : !responsibleId ? 'notplanned' : elapsed ? 'missing' : 'progress';
        calendar.push({ day, responsible, responsibleId, state: stateLabel, closedAt: closure?.closedAt || null, cashClosed: !!cash?.notes?.closed, sections: Object.fromEntries(['agenda', 'team', 'hair', 'products', 'cash', 'tomorrow', 'client_cases'].map(k => [k, values.get(`shift_${k}_${day}`) || null])) });
        if (elapsed && stateLabel === 'missing' && responsibleId && !state.seen.includes(`missing:${day}`))
            issue(`missing:${day}`, 'Verbali mancanti', day, `${day} · ${responsible}: verbale mancante`, '#verbali', true);
        for (const x of dayPeople.filter(x => participants.some(p => p.id === x.p.id))) {
            const { p, entry, attendance, logs, working } = x;
            const startTime = entry?.start_time || entry?.category.start_time;
            const endTime = entry?.end_time || entry?.category.end_time;
            const record = { working, userId: p.id, name: p.name, day, shift: entry?.category.name || 'Non programmato', start: startTime || '', end: endTime || '', entry: attendance.firstEntry ? clock(new Date(attendance.firstEntry.timestamp)) : '', exit: attendance.lastExit ? clock(new Date(attendance.lastExit.timestamp)) : '', pauses: attendance.breaks.map(b => `${clock(new Date(b.pausa.timestamp))}–${b.rientro ? clock(new Date(b.rientro.timestamp)) : 'aperta'}`).join(', ') };
            daily.push(record);
            const pushLate = (id: string, label: string, note: string) => events.push({ id, userId: p.id, day, kind: 'late', label, source: 'Timbrature e turnistica', reference: logs.map(l => l.id).join(','), units: 1, amount: rules.late, needsDecision: !!note, note });
            if (working && attendance.firstEntry && startTime) {
                const delay = minutes(record.entry) - minutes(startTime);
                if (delay > rules.entryGrace)
                    pushLate(`${p.id}:${day}:entry`, `Ingresso ${record.entry} · +${delay} min`, savedTeam?.decisions?.[`${p.id}:entry`]?.note || '');
            }
            attendance.breaks.forEach(b => { if (!b.rientro)
                return; const duration = Math.floor((+new Date(b.rientro.timestamp) - +new Date(b.pausa.timestamp)) / 60000); if (duration > 60) {
                const id = `${p.id}:pause:${new Date(b.pausa.timestamp).toISOString()}`;
                pushLate(id, `Rientro pausa · +${duration - 60} min`, savedTeam?.decisions?.[id]?.note || '');
            } });
            const decision = savedTeam?.decisions?.[`${p.id}:missing`];
            if (elapsed && working && !attendance.firstEntry && !decision?.choice)
                issue(`attendance:${p.id}:${day}`, 'Timbrature da verificare', day, `${p.name} · turno senza timbratura o giustificazione`, '/attendance');
            if (decision?.choice === 'Dimenticato di timbrare' && !attendance.firstEntry)
                issue(`forgot:${p.id}:${day}`, 'Timbrature da verificare', day, `${p.name} · inserire gli orari corretti della timbratura dimenticata`, '/attendance');
            if (decision?.choice === 'Malattia richiesta' && !x.leave)
                issue(`sick:${p.id}:${day}`, 'Malattie da verificare', day, `${p.name} · malattia dichiarata senza richiesta approvata`, '/requests');
        }
    }
    let bookings: any[] = [];
    try {
        bookings = await getCompleteCowlendarBookingsForRange(start.toISOString(), new Date(+end - 1).toISOString());
    }
    catch {
        issue('calendar-source', 'Fonti mancanti', endDay, 'Calendario non disponibile: impossibile verificare le schede e gli appuntamenti aperti', '/appointments');
    }
    const responses = await prisma.serviceFormResponse.findMany({ where: { form_id: { in: forms.filter(f => isClientControlFormName(f.name, f.category)).map(f => f.id) }, OR: [{ created_at: { gte: start, lt: end } }, ...bookings.map(b => ({ answers: { path: ['booking_id'], equals: String(b.id) } }))] }, select: { id: true, answers: true, created_at: true, updated_at: true }, orderBy: { updated_at: 'desc' } });
    const latest = new Map<string, typeof responses[number]>();
    for (const r of responses) {
        const a = r.answers as any;
        const id = text(a.booking_id) || `card:${r.id}`;
        if (!latest.has(id))
            latest.set(id, r);
    }
    const bookingsMap = new Map(bookings.map(b => [String(b.id), b]));
    const allIds = new Set([...bookingsMap.keys(), ...latest.keys()]);
    const statuses = values.get('appointment_status_overrides') || {};
    for (const id of allIds) {
        const b = bookingsMap.get(id);
        const r = latest.get(id);
        const a = (r?.answers || {}) as any;
        const day = romeAgendaDate(b?.start_date || a.client_control_completed_at || r!.created_at);
        if (!day.startsWith(month) || day > endDay)
            continue;
        if (!/buenos|corso/i.test([b?.service?.title, a.client_control_location].join(' ')))
            continue;
        const status = key(statuses[id]?.status || b?.attendance || b?.confirmation_status);
        if (b?.is_canceled || b?.isCanceled || ['annullato', 'canceled', 'cancelled', 'non_presentato', 'no_show', 'no-show', 'no show', 'riprogrammato', 'spostato'].includes(status))
            continue;
        const sections = Array.isArray(a.worker_service_sections) ? a.worker_service_sections : [];
        const staffNames = names(a.client_control_service_staff);
        if (!staffNames.length)
            staffNames.push(...names(a.client_control_service_owner));
        if (!staffNames.length && !sections.length && !a.primary_staff_id) {
            const team = values.get('appointment_team_overrides')?.[id]?.teammates || b?.teammates || [];
            staffNames.push(...team.map((t: any) => text(t.name || [t.firstname, t.lastname].filter(Boolean).join(' ')).split('|')[0].trim()));
        }
        const assigned = people.filter(p => sections.some((s: any) => s.staffId === p.id) || a.primary_staff_id === p.id || staffNames.some(n => matches(n, p.name)));
        const confirmed = a.client_control_is_draft !== true && a.client_control_is_draft !== 'true' && key(a.client_control_correctness) === 'controllato';
        const client = text(a.client_control_client_name || b?.customer?.name) || 'Cliente';
        const units = assigned.length > 1 ? rules.shared : 1;
        if (confirmed && !assigned.length)
            issue(`staff:${id}`, 'Schede da collegare', day, `${client} · staff della scheda non identificato`, '/appointments');
        for (const p of assigned.filter(p => rules.participants.includes(p.id) && (confirmed || Date.now() >= shiftDeadline(day))))
            events.push({ id: `card:${id}:${p.id}`, userId: p.id, day, kind: 'card', label: `${client} · ${confirmed ? 'scheda confermata' : 'scheda aperta'}${assigned.length > 1 ? ' · condivisa' : ''}`, source: 'Controllo cliente', reference: r?.id || id, units, amount: 0, needsDecision: !confirmed, note: !confirmed ? 'La direzione decide se contare la scheda nella media.' : '' });
        if (!confirmed && Date.now() >= shiftDeadline(day)) {
            const resp = responsibilities.get(day);
            if (resp)
                events.push({ id: `open:${id}`, userId: resp, day, kind: 'open', label: `${client} · ${r ? 'scheda in bozza' : 'senza scheda'}`, source: 'Agenda e verbale', reference: id, units: 1, amount: rules.open, needsDecision: false, note: 'La penalità resta anche se la scheda viene conteggiata per la parrucchiera.' });
        }
    }
    for (const sheet of normalizeAssistanceSheets(values.get('assistance_tables'))) {
        const col = (pattern: RegExp) => sheet.columns.find(c => pattern.test(c.label))?.id || '';
        if (/sistemazione fasc/i.test(sheet.name)) {
            for (const row of sheet.rows) {
                const day = romeAgendaDate(row.createdAt);
                if (!day.startsWith(month) || day > endDay)
                    continue;
                const v = row.values;
                const cause = text(v.__qualityCause || v[col(/^causa$/i)]);
                const client = text(v[col(/nome cliente/i)]) || 'Cliente';
                if (!(QUALITY_CAUSES as readonly string[]).includes(cause)) {
                    issue(`cause:${row.id}`, 'Sistemazioni senza causa', day, `${client} · scegliere la causa`, '/tables');
                    continue;
                }
                if (!row.reviewedAt)
                    issue(`review:${row.id}`, 'Sistemazioni da verificare', day, `${client} · verifica del servizio non conclusa`, '/tables');
                if (!row.reviewedAt || v.__qualityConfirmed === 'false')
                    continue;
                const previous = names(v.__qualityOriginalPrevious || v[col(/app.*precedente/i)]);
                const performed = names(v[col(/^sistemazione$/i)]);
                if (cause === 'Lavoro imputabile' && !people.some(p => previous.some(n => matches(n, p.name))))
                    issue(`original:${row.id}`, 'Sistemazioni da collegare', day, `${client} · identificare chi ha eseguito il lavoro precedente`, '/tables');
                if (!people.some(p => performed.some(n => matches(n, p.name))))
                    issue(`performer:${row.id}`, 'Sistemazioni da collegare', day, `${client} · identificare chi ha sistemato`, '/tables');
                for (const p of participants) {
                    if (cause === 'Lavoro imputabile' && previous.some(n => matches(n, p.name)))
                        events.push({ id: `rework:${row.id}:${p.id}`, userId: p.id, day, kind: 'rework', label: client, source: 'Sistemazione fasce', reference: row.id, units: 1, amount: rules.rework, needsDecision: false, note: cause });
                    if (performed.some(n => matches(n, p.name)) && !previous.some(n => matches(n, p.name)) && previous.length && previous.every(n => !['da verificare', 'staff paradise'].includes(key(n))))
                        events.push({ id: `repair:${row.id}:${p.id}`, userId: p.id, day, kind: 'repair', label: client, source: 'Sistemazione fasce', reference: row.id, units: 1, amount: rules.repair, needsDecision: false, note: cause });
                }
            }
        }
        if (/recension.*negativ/i.test(sheet.name))
            for (const row of sheet.rows) {
                const raw = text(row.values[col(/data recensione/i)]);
                const match = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
                const day = match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : '';
                if (!day) {
                    issue(`reviewdate:${row.id}`, 'Recensioni da collegare', endDay, 'Recensione negativa con data non interpretabile', '/tables');
                    continue;
                }
                if (!day.startsWith(month))
                    continue;
                const salon = text(row.values[col(/sede/i)]);
                if (!/buenos|corso/i.test(salon)) {
                    if (!salon)
                        issue(`reviewsite:${row.id}`, 'Recensioni da collegare', day, 'Recensione senza salone', '/tables');
                    continue;
                }
                for (const p of participants) {
                    const working = daily.find(x => x.userId === p.id && x.day === day && x.working);
                    if (working)
                        events.push({ id: `negative:${row.id}:${p.id}`, userId: p.id, day, kind: 'negative', label: text(row.values[col(/nome cliente/i)]) || 'Recensione negativa', source: 'Registro recensioni negative', reference: row.id, units: 1, amount: rules.negative, needsDecision: false, note: '' });
                }
            }
    }
    for (const r of state.positiveReviews || [])
        events.push({ id: `positive:${r.id}`, userId: r.userId, day: r.day, kind: 'positive', label: 'Recensione positiva nominativa', source: 'Recensione verificata dalla direzione', reference: r.reference, units: 1, amount: rules.positive, needsDecision: false, note: '' });
    if (!state.positiveReviewed)
        issue('positive-source', 'Recensioni positive', endDay, 'Collegare le recensioni positive nominative e confermare la verifica del mese', '#recensioni-positive');
    if (rules.managementEnabled)
        issue('management-source', 'Indicatori gestione', endDay, 'Collegare i 7 indicatori del nuovo verbale prima di attivare la quota gestione', '#regole');
    for (let d = Number(endDay.slice(8)) + 1; d <= Number(last.slice(8)); d++)
        calendar.push({ day: `${month}-${String(d).padStart(2, '0')}`, responsible: '', responsibleId: '', state: 'future', closedAt: null, sections: {} });
    const sourceHash = createHash('sha256').update(JSON.stringify({ events, rules, issues, daily, calendar })).digest('hex');
    return { month, today, rules, rulesSaved: !!applicable, state, people: people.map(p => ({ id: p.id, name: p.name, active: p.active })), calendar, daily, events, issues, rows: calculateDirectionBonus(people, events, rules, state.decisions), sourceHash, generatedAt: new Date().toISOString(), partial: month === today.slice(0, 7) };
}
export type DirectionBonusData = Awaited<ReturnType<typeof loadDirectionBonus>>;
