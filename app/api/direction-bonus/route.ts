import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { loadDirectionBonus } from '@/lib/direction-bonus-data';
import { DIRECTION_ROLES, eventFingerprint, validBonusRules, type BonusRules } from '@/lib/direction-bonus';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) { const s = await auth(); if (!s?.user?.id || !DIRECTION_ROLES.has(s.user.role))
    return NextResponse.json({ error: 'Area riservata alla direzione' }, { status: 403 }); try {
    return NextResponse.json(await loadDirectionBonus(req.nextUrl.searchParams.get('month') || ''), { headers: { 'Cache-Control': 'private, no-store' } });
}
catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Dati non disponibili' }, { status: 400 });
} }
export async function POST(req: NextRequest) {
    const s = await auth();
    if (!s?.user?.id || !DIRECTION_ROLES.has(s.user.role))
        return NextResponse.json({ error: 'Area riservata alla direzione' }, { status: 403 });
    try {
        const b = await req.json();
        const report = await loadDirectionBonus(b.month);
        if (report.state.approvedAt)
            throw new Error('Mese bloccato');
        if (b.revision !== report.state.revision)
            throw new Error('Dati aggiornati da un’altra persona. Ricarica.');
        const state = structuredClone(report.state);
        const now = new Date().toISOString();
        const actor = s.user.name || s.user.id;
        let reason = '';
        if (b.action === 'seen') {
            const issue = report.issues.find(i => i.id === b.id && i.acknowledge);
            if (!issue)
                throw new Error('Segnalazione non disponibile');
            state.seen = [...new Set([...state.seen, b.id])];
            reason = `Presa visione: ${issue.label}`;
        }
        else if (b.action === 'calculate') {
            if (report.issues.length)
                throw new Error('Risolvi prima le voci aperte');
            state.calculatedAt = now;
            state.sourceHash = report.sourceHash;
            reason = 'Calcolo del mese dalle fonti aggiornate';
        }
        else if (b.action === 'decision') {
            if (state.sourceHash !== report.sourceHash)
                throw new Error('Le fonti sono cambiate: registra un nuovo calcolo prima delle decisioni');
            if (!state.calculatedAt || report.issues.length)
                throw new Error('Completa prima la chiusura dati e il calcolo');
            const event = report.events.find(e => e.id === b.id);
            if (!event || !['COUNT', 'CANCEL'].includes(b.choice) || typeof b.reason !== 'string' || !b.reason.trim() || b.reason.length > 2000)
                throw new Error('Seleziona un evento e scrivi il motivo');
            state.decisions[b.id] = { choice: b.choice, reason: b.reason.trim(), at: now, actor, fingerprint: eventFingerprint(event) };
            reason = `${b.choice === 'COUNT' ? 'Conta' : 'Annulla'} · ${event.label}: ${b.reason.trim()}`;
        }
        else if (b.action === 'rules') {
            if (!validBonusRules(b.rules) || b.rules.effectiveMonth !== b.month || b.rules.participants.some((id: string) => !report.people.some(p => p.id === id)))
                throw new Error('Controlla regole, partecipanti e mese di validità');
            reason = `Regole valide da ${b.month}`;
            delete state.calculatedAt;
            delete state.sourceHash;
        }
        else if (b.action === 'positive_review') {
            if (typeof b.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.day) || !b.day.startsWith(b.month) || b.day > report.today || !report.rules.participants.includes(b.userId) || typeof b.reference !== 'string' || !b.reference.trim() || b.reference.length > 1000)
                throw new Error('Indica data, persona e riferimento alla recensione');
            if ((state.positiveReviews || []).some(r => r.reference === b.reference.trim() && r.userId === b.userId))
                throw new Error('Recensione già collegata a questa persona');
            state.positiveReviews = [...(state.positiveReviews || []), { id: crypto.randomUUID(), userId: b.userId, day: b.day, reference: b.reference.trim() }];
            state.positiveReviewed = false;
            delete state.calculatedAt;
            delete state.sourceHash;
            reason = `Recensione positiva collegata: ${b.reference.trim()}`;
        }
        else if (b.action === 'reviews_checked') {
            state.positiveReviewed = true;
            reason = 'Confermata la verifica delle recensioni positive del mese';
        }
        else if (b.action === 'approve') {
            throw new Error('Approvazione non disponibile: completare la verifica dei dati di settembre e il blocco delle fonti prima di rendere definitivi i bonus.');
        }
        else
            throw new Error('Azione non valida');
        state.revision++;
        state.audit.push({ id: crypto.randomUUID(), at: now, actor, action: b.action, reason });
        await prisma.$transaction(async (tx) => {
            const monthKey = `direction_bonus_month_${b.month}`;
            const old = await tx.setting.findUnique({ where: { key: monthKey } });
            if (((old?.value as any)?.revision || 0) !== b.revision)
                throw new Error('Conflitto: ricarica');
            if (old) {
                const r = await tx.setting.updateMany({ where: { key: monthKey, value: { equals: old.value! } }, data: { value: JSON.parse(JSON.stringify(state)) } });
                if (!r.count)
                    throw new Error('Conflitto: ricarica');
            }
            else
                await tx.setting.create({ data: { key: monthKey, value: JSON.parse(JSON.stringify(state)) } });
            if (b.action === 'rules') {
                const key = 'direction_bonus_rules';
                const oldRules = await tx.setting.findUnique({ where: { key } });
                const versions = (oldRules?.value || []) as BonusRules[];
                const approved = await tx.setting.findMany({ where: { key: { startsWith: 'direction_bonus_month_' } } });
                if (approved.some(x => (x.value as any)?.approvedAt && x.key.slice(-7) >= b.month))
                    throw new Error('Le regole non possono modificare mesi approvati');
                const value = JSON.parse(JSON.stringify([...versions.filter(v => v.effectiveMonth !== b.month), b.rules]));
                if (oldRules) {
                    const r = await tx.setting.updateMany({ where: { key, value: { equals: oldRules.value! } }, data: { value } });
                    if (!r.count)
                        throw new Error('Regole cambiate nel frattempo');
                }
                else
                    await tx.setting.create({ data: { key, value } });
            }
        });
        return NextResponse.json(await loadDirectionBonus(b.month));
    }
    catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Salvataggio non riuscito' }, { status: 400 });
    }
}
