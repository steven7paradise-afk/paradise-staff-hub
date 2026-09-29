import { defaultResultBonusDailyValues, defaultResultBonusRules, parseResultBonusDailyValues, parseResultBonusRules, RESULT_BONUS_DYNAMICS, RESULT_BONUS_LEVELS, type ResultBonusState, type ResultBonusDynamic, type ResultBonusLevel } from "./result-bonus";

export class ResultBonusSettingsConflict extends Error {}

/** Three-way merge: only change edited fields, never overwrite someone else's edit. */
export function mergeResultBonusSettings(state: ResultBonusState, body: Record<string, unknown>) {
  const nextRules = parseResultBonusRules(body.rules);
  const currentRules = state.rules ?? defaultResultBonusRules();
  const currentDaily = state.dailyValues ?? defaultResultBonusDailyValues();
  const nextDaily = body.dailyValues === undefined ? currentDaily : parseResultBonusDailyValues(body.dailyValues);
  const revision = Number(body.revision);
  if (!Number.isInteger(revision) || revision < 0 || revision > state.revision) throw new ResultBonusSettingsConflict("Versione dei dati non valida. Le modifiche non sono state salvate.");
  if (body.baseRules === undefined || body.baseDailyValues === undefined) {
    if (revision !== state.revision) throw new ResultBonusSettingsConflict("I dati sono stati aggiornati. Le modifiche restano nel modulo: riprova con la pagina aggiornata.");
    return { rules: nextRules, dailyValues: nextDaily };
  }
  const baseRules = parseResultBonusRules(body.baseRules);
  const baseDaily = parseResultBonusDailyValues(body.baseDailyValues);
  const rules = { ...currentRules };
  const dailyValues = { ...currentDaily };
  const conflicts: string[] = [];
  const sameRule = (a: typeof rules[ResultBonusDynamic], b: typeof rules[ResultBonusDynamic]) => a.mode === b.mode && a.amount === b.amount;
  for (const key of Object.keys(rules) as ResultBonusDynamic[]) {
    if (sameRule(nextRules[key], baseRules[key])) continue;
    if (!sameRule(currentRules[key], baseRules[key]) && !sameRule(currentRules[key], nextRules[key])) conflicts.push(RESULT_BONUS_DYNAMICS[key].label);
    else rules[key] = nextRules[key];
  }
  if (body.dailyValues !== undefined) for (const level of Object.keys(dailyValues) as ResultBonusLevel[]) {
    if (nextDaily[level] === baseDaily[level]) continue;
    if (currentDaily[level] !== baseDaily[level] && currentDaily[level] !== nextDaily[level]) conflicts.push(`Valore giornata ${RESULT_BONUS_LEVELS[level].label}`);
    else dailyValues[level] = nextDaily[level];
  }
  if (conflicts.length) throw new ResultBonusSettingsConflict(`Modificate anche da un’altra sessione: ${conflicts.join(", ")}. Nessun valore sovrascritto; le tue modifiche restano nel modulo.`);
  return { rules, dailyValues };
}
