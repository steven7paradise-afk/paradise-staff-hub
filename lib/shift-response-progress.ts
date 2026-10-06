import { activeShiftFollowUps, type ShiftResponsibleQuestion } from "./shift-responsible-questions";

export function shiftResponseProgress(questions: ShiftResponsibleQuestion[], answers: Record<string, string>) {
  const required = questions.filter(question => question.required !== false);
  const started = Object.values(answers).some(value => value.trim().length > 0);
  const completed = required.filter(question => Boolean(answers[question.id]?.trim()) &&
    activeShiftFollowUps(question, answers[question.id]).every(followUp => Boolean(answers[`${question.id}::${followUp.key}`]?.trim()))).length;
  return { completed, total: required.length, percent: required.length ? Math.floor(completed / required.length * 100) : started ? 100 : 0 };
}

export function shiftResponseDays(assignments: Record<string, string>, answers: Record<string, Record<string, string>>) {
  return [...new Set([...Object.keys(assignments), ...Object.keys(answers)])].sort((a, b) => b.localeCompare(a));
}

export function shiftResponseState(day: string, today: string, progress: { percent: number }, answers: Record<string, string>) {
  if (progress.percent === 100) return "Completato";
  if (Object.values(answers).some(value => value.trim())) return "In compilazione";
  return day > today ? "Programmato" : "Da iniziare";
}
