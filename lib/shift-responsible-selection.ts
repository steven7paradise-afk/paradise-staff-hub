export type ResponsibleCandidate = { id: string; vice: boolean; working: boolean; resting: boolean; clockedIn: boolean };

/** A late/unclocked manager does not automatically delegate to the deputy. */
export function selectShiftResponsible(people: ResponsibleCandidate[], preferredId?: string) {
  const managers = people.filter(person => !person.vice);
  const eligibleManagers = managers.filter(person => person.working && person.clockedIn);
  const eligible = eligibleManagers.length ? eligibleManagers : managers.length > 0 && managers.every(person => person.resting)
    ? people.filter(person => person.vice && person.working && person.clockedIn) : [];
  return eligible.find(person => person.id === preferredId)?.id ?? eligible[0]?.id;
}
