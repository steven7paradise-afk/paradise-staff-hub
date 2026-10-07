export const HAIR_CATEGORIES = ['Microcheratina', 'Microtessitura Ricce', 'Microtessitura', 'Biadesivo', 'Clip', 'Topper', 'Parrucche', 'Coda Paradise'];
export type HairRow = {productId:string;present:string;order:string;note:string};
export type HairNotes = {lowStock:boolean|null;rows:HairRow[]};
export function validHairNotes(value:unknown,productIds:Set<string>):value is HairNotes {
 if(!value||typeof value!=='object')return false;const n=value as HairNotes;
 if(typeof n.lowStock!=='boolean'||!Array.isArray(n.rows)||n.rows.length>100)return false;
 if(!n.lowStock)return n.rows.length===0;
 if(!n.rows.length||new Set(n.rows.map(r=>r?.productId)).size!==n.rows.length)return false;
 return n.rows.every(r=>r&&productIds.has(r.productId)&&typeof r.present==='string'&&/^\d+(?:[.,]\d{1,2})?$/.test(r.present)&&Number(r.present.replace(',','.'))<=1000000&&typeof r.order==='string'&&/^\d+(?:[.,]\d{1,2})?$/.test(r.order)&&Number(r.order.replace(',','.'))>0&&Number(r.order.replace(',','.'))<=1000000&&typeof r.note==='string'&&r.note.length<=1000);
}
