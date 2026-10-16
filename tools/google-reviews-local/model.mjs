import { createHash } from 'node:crypto';
export const people = ['Nicol Bocharska','Aurora Dassisti','Giuseppe Pio Lombardi','Laura Barreca','Melissa Jaku','Angelica Pasculli','Simona Botros'];
const aliases = [['nicol','nicole'],['aurora'],['giuseppe','pio'],['laura'],['melissa'],['angelica'],['simona']];
export function suggestions(text) { const words=String(text).toLowerCase().match(/[\p{L}]+/gu)||[];return people.filter((_,i)=>aliases[i].some(a=>words.includes(a))); }
export function monthOf(date){const d=new Date(date);if(!Number.isFinite(+d)) throw Error('Data non valida. Serve la data esatta di pubblicazione.');return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit'}).format(d);}
export function normalize(r,source='file') {
 const date=r.createTime||r.date; if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(date))throw Error('Ogni recensione deve avere una data esatta (YYYY-MM-DD o createTime Google).');
 const createTime=date.length===10?`${date}T12:00:00+02:00`:date;monthOf(createTime);
 if(date.length===10&&new Date(createTime).toISOString().slice(0,10)!==date)throw Error('Data di calendario non valida.');
 const rating=Number(r.rating||({ONE:1,TWO:2,THREE:3,FOUR:4,FIVE:5}[r.starRating]));if(!Number.isInteger(rating)||rating<1||rating>5)throw Error('Le stelle devono essere da 1 a 5.');
 const author=String(r.reviewer?.displayName||r.author||'').trim();if(!author||author.length>200)throw Error('Nome cliente mancante o troppo lungo.');
 const comment=String(r.comment??r.text??'').trim();if(comment.length>20000)throw Error('Testo troppo lungo.');
 let url=String(r.url||'');if(url){const u=new URL(url);if(u.protocol!=='https:'||!(/(^|\.)google\.[a-z.]+$/.test(u.hostname)||['maps.app.goo.gl','g.co'].includes(u.hostname)))throw Error('Inserisci un link HTTPS di Google Maps.');}
 const id=String(r.reviewId||r.id||createHash('sha256').update(author.toLowerCase()+'|'+createTime+'|'+comment).digest('hex'));if(id.length>300)throw Error('ID recensione non valido.');
 return {id,author,createTime,rating,comment,url,source,status:'pending',assigned:suggestions(comment),note:'',verifiedAt:null,revision:1};
}
export function mergeReviews(existing,incoming){const map=new Map(existing.map(r=>[r.id,r]));let added=0,updated=0;for(const r of incoming){const old=map.get(r.id);if(!old){map.set(r.id,r);added++;}else if(['author','createTime','rating','comment','url'].some(k=>old[k]!==r[k])){map.set(r.id,{...r,revision:old.revision+1,note:old.note});updated++;}}return {reviews:[...map.values()],added,updated};}
export function verify(review,body){if(body.revision!==review.revision)throw Error('La recensione è cambiata. Ricarica la pagina prima di salvarla.');if(!['pending','confirmed','excluded'].includes(body.status))throw Error('Stato non valido.');if(!Array.isArray(body.assigned)||body.assigned.some(n=>!people.includes(n)))throw Error('Collaboratore non valido.');const assigned=[...new Set(body.assigned)];if(body.status==='confirmed'&&(!body.checked||!review.comment))throw Error('Verifica data, testo e persone prima di confermare.');return {...review,assigned,status:body.status,note:String(body.note||'').slice(0,2000),positive:body.status==='confirmed'&&body.positive===true,verifiedAt:body.status==='confirmed'?new Date().toISOString():null,revision:review.revision+1};}
export function award(r){return r.status==='confirmed'&&r.positive?r.assigned.length*5:0;}
