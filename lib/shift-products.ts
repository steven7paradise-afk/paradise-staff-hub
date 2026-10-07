export type SupplyRow={productId:string;name:string;quantity:string;note:string};
export type SupplyNotes={needed:boolean|null;rows:SupplyRow[]};
export function validSupplyNotes(value:unknown,ids:Set<string>):value is SupplyNotes {
 if(!value||typeof value!=='object')return false;const n=value as SupplyNotes;
 if(typeof n.needed!=='boolean'||!Array.isArray(n.rows)||n.rows.length>100)return false;
 if(!n.needed)return n.rows.length===0;
 if(!n.rows.length)return false;
 const keys=n.rows.map(r=>r?.productId||r?.name?.trim().toLocaleLowerCase('it'));
 return new Set(keys).size===keys.length&&n.rows.every(r=>r&&typeof r.productId==='string'&&(!r.productId||ids.has(r.productId))&&typeof r.name==='string'&&r.name.trim().length>0&&r.name.length<=200&&typeof r.quantity==='string'&&/^\d+$/.test(r.quantity)&&Number(r.quantity)>0&&Number(r.quantity)<=100000&&typeof r.note==='string'&&r.note.length<=1000);
}
export function supplyAmounts(requested:number,available:number){return {bring:Math.min(requested,available),missing:Math.max(0,requested-available)};}
