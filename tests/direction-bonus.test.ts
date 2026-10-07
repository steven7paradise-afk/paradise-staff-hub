import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDirectionBonus, eventFingerprint, proposedRules, validBonusRules, type BonusEvent } from '../lib/direction-bonus';
const event = (overrides: Partial<BonusEvent> = {}): BonusEvent => ({ id: 'one', userId: 'a', day: '2026-09-01', kind: 'card', label: 'Scheda', source: 'test', reference: '1', units: 1, amount: 0, needsDecision: false, note: '', ...overrides });
test('reference September arithmetic matches all seven example totals (not a source reconciliation)', () => {
    const samples = [['Nicol Bocharska', 6.5, -10, 5, -60, -40, 30, 575], ['Aurora Dassisti', 6.3, -50, 10, -75, -70, 20, 465], ['Giuseppe Pio Lombardi', 5.8, -80, 10, -60, -90, 25, 385], ['Laura Barreca', 4.2, -30, 20, -15, -60, 40, 375], ['Angelica Pasculli', 3.4, -50, 10, -15, -50, 10, 245], ['Melissa Jaku', 4.2, -30, 10, -75, -100, 10, 235], ['Simona Botros', 1.4, -10, 20, -15, -30, 10, 115]] as const;
    let total = 0;
    for (const [name, average, late, positive, negative, rework, repair, expected] of samples) {
        const rules = proposedRules('2026-09', ['a']);
        const divisor = name === 'Laura Barreca' ? 21 : 24;
        const events = [event({ units: Math.round(average * divisor * 2) / 2 }), ...Object.entries({ late, positive, negative, rework, repair }).map(([kind, amount]) => event({ id: kind, kind: kind as BonusEvent['kind'], amount }))];
        const [row] = calculateDirectionBonus([{ id: 'a', name }], events, rules, {});
        assert.equal(row.total, expected);
        total += row.total;
    }
    assert.equal(total, 2395);
});
test('draft decisions count cards without deleting separate responsible penalty', () => {
    const rules = proposedRules('2026-10', ['a']);
    const draft = event({ needsDecision: true, units: 24 });
    const penalty = event({ id: 'open', kind: 'open', amount: -10 });
    const p = [{ id: 'a', name: 'Worker' }];
    assert.equal(calculateDirectionBonus(p, [draft, penalty], rules, {})[0].total, -10);
    const decision = { choice: 'COUNT' as const, reason: 'Verificata', actor: 'Direction', at: '2026-10-07', fingerprint: eventFingerprint(draft) };
    assert.equal(calculateDirectionBonus(p, [draft, penalty], rules, { one: decision })[0].total, 90);
    assert.equal(calculateDirectionBonus(p, [{ ...draft, units: 25 }, penalty], rules, { one: decision })[0].pending, 1);
});
test('cancellation preserves evidence and negative floor is optional', () => {
    const rules = proposedRules('2026-10', ['a']);
    const late = event({ kind: 'late', amount: -10 });
    const people = [{ id: 'a', name: 'Worker' }];
    assert.equal(calculateDirectionBonus(people, [late], rules, {})[0].total, -10);
    assert.equal(calculateDirectionBonus(people, [late], { ...rules, negativeFloor: true }, {})[0].total, 0);
    const [row] = calculateDirectionBonus(people, [late], rules, { one: { choice: 'CANCEL', reason: 'Errore corretto', actor: 'Direction', at: '2026-10-07', fingerprint: eventFingerprint(late) } });
    assert.equal(row.total, 0);
    assert.equal(row.events.length, 1);
});
test('rules reject nonfinite values and duplicate participants', () => { const r = proposedRules('2026-10', ['a']); assert.ok(validBonusRules(r)); assert.ok(!validBonusRules({ ...r, days: 0 })); assert.ok(!validBonusRules({ ...r, late: NaN })); assert.ok(!validBonusRules({ ...r, participants: ['a', 'a'] })); });

test('individual PDF preview can render multiple pages with decision evidence', async () => {
    const { directionPdf, csvCell } = await import('../lib/direction-bonus-export');
    const rules = proposedRules('2026-10', ['a']);
    const events = Array.from({ length: 90 }, (_, i) => event({ id: String(i), label: `Evento di controllo ${i}` }));
    const rows = calculateDirectionBonus([{ id: 'a', name: 'Persona di prova' }], events, rules, {});
    const doc = directionPdf({ month: '2026-10', today: '2026-10-07', rows, rules, rulesSaved: false, issues: [], state: { revision: 0, decisions: {}, seen: [], audit: [] }, people: [], calendar: [], daily: [], events, sourceHash: 'test', generatedAt: '2026-10-07T12:00:00Z', partial: true }, 'a');
    assert.ok(doc.getNumberOfPages() > 1);
    assert.ok(doc.output().startsWith('%PDF-'));
    assert.equal(csvCell('=1+1'), '"\'=1+1"');
});
