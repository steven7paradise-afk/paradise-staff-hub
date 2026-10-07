export type CashNotes = { discrepancy: boolean | null; amount: string; kind: string; explanation: string; closed: boolean };
export const emptyCashNotes: CashNotes = { discrepancy: null, amount: '', kind: '', explanation: '', closed: false };
export function validCashNotes(n: CashNotes): boolean {
  return !!n && typeof n.discrepancy === 'boolean' && typeof n.closed === 'boolean' && typeof n.amount === 'string' && typeof n.explanation === 'string' && n.explanation.length <= 5000 && (n.discrepancy === false || (/^\d+(?:[.,]\d{1,2})?$/.test(n.amount) && Number(n.amount.replace(',', '.')) > 0 && Number(n.amount.replace(',', '.')) <= 1000000 && ['MISSING', 'EXTRA'].includes(n.kind) && !!n.explanation.trim()));
}
export function cashComplete(n: CashNotes): boolean { return validCashNotes(n) && n.closed; }
