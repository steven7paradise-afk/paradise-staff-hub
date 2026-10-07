// Resolve 19:30 Europe/Rome for the report date, including daylight saving.
export function shiftDeadline(day: string): number {
 const probe = new Date(`${day}T19:30:00Z`);
 const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(probe);
 const value = (type: string) => Number(parts.find(p=>p.type===type)?.value);
 const localAsUtc = Date.UTC(value('year'),value('month')-1,value('day'),value('hour'),value('minute'),value('second'));
 return probe.getTime()-(localAsUtc-probe.getTime());
}
