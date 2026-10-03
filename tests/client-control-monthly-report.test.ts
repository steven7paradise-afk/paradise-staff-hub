import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyStaffReport } from '../lib/client-control-monthly-report';
import { buildClientControlAnalytics } from '../lib/client-control-analytics';
import { createClientControlMonthlyPdf } from '../lib/client-control-monthly-pdf';
test('report mensile: principale unico, sede e personale attivo; esclude bozze dalle percentuali',()=>{
 const staff=[{id:'a',name:'Nicol',active:true,salon:'Salone Buenos Aires'},{id:'b',name:'Ufficio',active:true,salon:'Ufficio Paradise'}];
 const rows=buildClientControlAnalytics({month:'2026-09',staff,bookings:[],cards:[{id:'c',created_at:'2026-09-10T10:00:00Z',updated_at:'2026-09-10T10:00:00Z',user_location_name:'Salone Buenos Aires',answers:{primary_staff_id:'a',client_control_correctness:'Controllato',client_control_is_draft:false,client_control_notes_text:'Servizio svolto'}}]});
 const result=monthlyStaffReport(rows,staff,[],{a:20});
 assert.equal(result.length,1);assert.equal(result[0].clients,1);assert.equal(result[0].clockDays,20);
 const pending=monthlyStaffReport(rows.map(r=>({...r,category:'pending' as const})),staff,[],{});
 assert.equal(pending[0].clients,0);assert.equal(pending[0].pending,1);assert.equal(pending[0].clockDays,0);
});
test('PDF gestisce mese vuoto e mese in corso senza classifiche inventate',()=>{
 const pdf=Buffer.from(createClientControlMonthlyPdf('2026-10',[],new Date('2026-10-03T10:00:00Z'))).toString('latin1');
 assert.ok(pdf.startsWith('%PDF-'));assert.ok(pdf.includes('dati parziali'));assert.ok(pdf.includes('Nessun dato positivo registrato'));
});

test('il confronto narrativo segue i risultati del mese, senza nomi fissi',()=>{
 const base={before:0,after:0,discovery:0,missing:0,pending:0,fallback:0,clockDays:20,lateDays:0};
 const people=[{...base,name:'Anna',clients:100,both:10,reviews:2,entryMinutes:10,breakMinutes:5,totalMinutes:15},{...base,name:'Bea',clients:90,both:20,reviews:8,entryMinutes:0,breakMinutes:2,totalMinutes:2}];
 const pdf=Buffer.from(createClientControlMonthlyPdf('2026-09',people,new Date('2026-10-03T10:00:00Z'))).toString('latin1');
 assert.ok(pdf.includes('Bea merita attenzione'));assert.ok(pdf.includes('Il confronto Anna / Bea'));assert.ok(!pdf.includes('Nicol'));
});
