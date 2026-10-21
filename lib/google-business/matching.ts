export function matchReviewStaff(comment: string | null, staff: {id:string;name:string}[]): string[] {
  const normalize=(value:string)=>value.normalize('NFC').toLocaleLowerCase('it');
  const words = new Set(normalize(comment || '').match(/[\p{L}\p{M}]+/gu) || []);
  const names=new Map<string,string[]>();
  for(const person of staff) {
    const firstName=normalize(person.name.trim().split(/\s+/)[0]);
    names.set(firstName,[...(names.get(firstName)||[]),person.id]);
  }
  // Multiple distinct names can match. An ambiguous first name needs manual review.
  return [...new Set([...names].filter(([name,ids])=>words.has(name)&&ids.length===1).flatMap(([,ids])=>ids))].sort();
}
