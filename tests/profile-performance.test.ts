import test from 'node:test';
import assert from 'node:assert/strict';
import { profilePerformance } from '../lib/profile-performance';
import type { CowlendarBooking } from '../lib/cowlendar';
const booking = (id: string, extra = {}) => ({id, start_date:'2026-10-01T10:00:00Z', attendance:'COMPLETATO', teammates:[{id:'worker',firstname:'Nicol',lastname:'Paradise'}],service:{title:'Piega'},...extra}) as CowlendarBooking;
test('monthly performance counts completed agenda bookings only, deduplicated and assigned',()=>{
 const rows=[booking('a'),booking('a'),booking('draft',{attendance:'CONFERMATO'}),booking('canceled',{is_canceled:true}),booking('other'),booking('old',{start_date:'2026-09-29T10:00:00Z'}),booking('future',{start_date:'2026-10-03T10:00:00Z'})];
 const result=profilePerformance(rows,{other:{teammates:[{id:'someone',name:'Altro'}]}},{},{id:'worker',name:'Nicol Paradise'},['Nicol Paradise','Altro'],new Date('2026-10-02T10:00:00Z'));
 assert.equal(result.total,1);assert.equal(result.activeDays,1);assert.deepEqual(result.daily.map(d=>d.count),[1,0]);assert.deepEqual(result.services,[{name:'Piega',count:1}]);
});
test('Rome month boundary and manual status take precedence',()=>{
 const result=profilePerformance([booking('a',{start_date:'2026-09-30T22:30:00Z',attendance:'CONFERMATO'}),booking('b')],{}, {a:{status:'COMPLETATO'},b:{status:'NON_PRESENTATO'}},{id:'worker',name:'Nicol Paradise'},['Nicol Paradise'],new Date('2026-10-02T10:00:00Z'));
 assert.equal(result.total,1);assert.equal(result.daily[0].count,1);
});
