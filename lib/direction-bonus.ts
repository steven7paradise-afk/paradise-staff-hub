export const DIRECTION_ROLES = new Set(['ZERO', 'SUPER_ADMIN', 'ADMIN']);
export const INITIAL_BONUS_NAMES = ['Laura Barreca', 'Giuseppe Pio Lombardi', 'Aurora Dassisti', 'Simona Botros', 'Nicol Bocharska', 'Angelica Pasculli', 'Melissa Jaku'];
export type BonusRules = {
    effectiveMonth: string;
    point: number;
    days: number;
    lauraDays: number;
    shared: number;
    entryGrace: number;
    late: number;
    positive: number;
    negative: number;
    rework: number;
    repair: number;
    open: number;
    management: number;
    managementEnabled: boolean;
    negativeFloor: boolean | null;
    taxLabel: '' | 'NETTO' | 'LORDO';
    participants: string[];
};
export function proposedRules(month: string, participants: string[]): BonusRules { return { effectiveMonth: month, point: 100, days: 24, lauraDays: 21, shared: .5, entryGrace: month < '2026-10' ? 3 : 0, late: -10, positive: 5, negative: month < '2026-10' ? -15 : -30, rework: -10, repair: 5, open: month < '2026-10' ? 0 : -10, management: month < '2026-10' ? 0 : 8.33, managementEnabled: false, negativeFloor: null, taxLabel: '', participants }; }
export type BonusEvent = {
    id: string;
    userId: string;
    day: string;
    kind: 'card' | 'late' | 'positive' | 'negative' | 'rework' | 'repair' | 'open' | 'management';
    label: string;
    source: string;
    reference: string;
    units: number;
    amount: number;
    needsDecision: boolean;
    note: string;
};
export type BonusDecision = {
    choice: 'COUNT' | 'CANCEL';
    reason: string;
    actor: string;
    at: string;
    fingerprint: string;
};
export type BonusIssue = {
    id: string;
    kind: string;
    day: string;
    label: string;
    href: string;
    acknowledge?: boolean;
};
export type BonusAudit = {
    id: string;
    at: string;
    actor: string;
    action: string;
    reason: string;
};
export type BonusMonthState = {
    positiveReviews?: {
        id: string;
        userId: string;
        day: string;
        reference: string;
    }[];
    positiveReviewed?: boolean;
    revision: number;
    decisions: Record<string, BonusDecision>;
    seen: string[];
    audit: BonusAudit[];
    calculatedAt?: string;
    sourceHash?: string;
    approvedAt?: string;
    approvedBy?: string;
};
export const emptyBonusMonth = (): BonusMonthState => ({ revision: 0, decisions: {}, seen: [], audit: [] });
export const eventFingerprint = (e: BonusEvent) => JSON.stringify([e.userId, e.day, e.kind, e.units, e.amount, e.note, e.reference]);
export function calculateDirectionBonus(people: {
    id: string;
    name: string;
}[], events: BonusEvent[], rules: BonusRules, decisions: Record<string, BonusDecision>) { return people.filter(p => rules.participants.includes(p.id)).map(p => { const own = events.filter(e => e.userId === p.id); const effective = own.filter(e => { const d = decisions[e.id]; return d?.fingerprint === eventFingerprint(e) ? d.choice === 'COUNT' : !e.needsDecision || e.kind !== 'card'; }); const cards = effective.filter(e => e.kind === 'card').reduce((n, e) => n + e.units, 0); const divisor = /^laura barreca$/i.test(p.name) ? rules.lauraDays : rules.days; const average = Math.round((cards / divisor + Number.EPSILON) * 10) / 10; const base = Math.round(average * rules.point); const amounts = Object.fromEntries(['late', 'positive', 'negative', 'rework', 'repair', 'open', 'management'].map(kind => [kind, effective.filter(e => e.kind === kind).reduce((n, e) => n + e.amount, 0)])) as Record<BonusEvent['kind'], number>; amounts.management = rules.managementEnabled ? Math.min(200, amounts.management) : 0; const raw = Math.round(base + Object.values(amounts).reduce((n, a) => n + a, 0)); return { ...p, cards, divisor, average, base, amounts, total: rules.negativeFloor ? Math.max(0, raw) : raw, pending: own.filter(e => e.needsDecision && decisions[e.id]?.fingerprint !== eventFingerprint(e)).length, events: own }; }); }
export function validBonusRules(r: BonusRules) { return !!r && /^20\d{2}-(0[1-9]|1[0-2])$/.test(r.effectiveMonth) && Array.isArray(r.participants) && r.participants.length > 0 && new Set(r.participants).size === r.participants.length && ['point', 'days', 'lauraDays', 'shared', 'entryGrace', 'late', 'positive', 'negative', 'rework', 'repair', 'open', 'management'].every(k => typeof r[k as keyof BonusRules] === 'number' && Number.isFinite(r[k as keyof BonusRules]) && Math.abs(Number(r[k as keyof BonusRules])) <= 10000) && r.days > 0 && r.lauraDays > 0 && r.shared >= 0 && r.shared <= 1 && r.entryGrace >= 0 && r.point >= 0 && typeof r.managementEnabled === 'boolean' && [null, true, false].includes(r.negativeFloor) && ['', 'NETTO', 'LORDO'].includes(r.taxLabel); }
