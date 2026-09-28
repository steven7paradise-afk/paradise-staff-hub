import assert from "node:assert/strict";
import test from "node:test";
import { reportPeriods, summarizeClientMonth, summarizeShiftMonth, type ClientReportRow } from "../lib/shift-monthly-report";
import type { ShiftResponsibleQuestion } from "../lib/shift-responsible-questions";
const periods=reportPeriods("2026-09","2026-09-28");
const q:ShiftResponsibleQuestion={id:"q",title:"Pulizia",description:"",answerType:"YES_NO",required:true,followUpYes:"",followUpNo:"Descrivi"};
test("confronta mesi parziali, febbraio e cambio anno",()=>{
 assert.equal(periods.previous.lastDay,"2026-08-28");
 assert.equal(reportPeriods("2026-03","2026-03-31").previous.lastDay,"2026-02-28");
 assert.equal(reportPeriods("2026-01","2026-09-28").previous.lastDay,"2025-12-31");
 assert.throws(()=>reportPeriods("2026-13","2026-09-28"));assert.throws(()=>reportPeriods("2026-10","2026-09-28"));
});
function client(id:string,overrides:Partial<ClientReportRow>={}):ClientReportRow{return{id,createdAt:"2026-09-03T10:00:00Z",answers:{client_control_service_staff:["Laura Barreca","LAURA BARRECA","Melissa Jaku"]},locationName:"Buenos Aires",...overrides};}
test("deduplica scheda e nominativi ma mantiene il servizio condiviso",()=>{
 const result=summarizeClientMonth([client("1"),client("1")],["Laura Barreca","Melissa Jaku"],periods.current);
 assert.equal(result.total,1);assert.equal(result.staff.length,2);assert.deepEqual(result.staff.map(s=>s.services),[1,1]);
});
test("esclude errore, finito e date fuori intervallo; usa data Roma",()=>{
 const rows=[client("error",{answers:{client_control_correctness:"Errore"}}),client("skip",{answers:{client_control_correctness:"Finito"}}),client("end",{createdAt:"2026-09-28T22:30:00Z"}),client("start",{createdAt:"2026-08-31T22:30:00Z"})];
 const r=summarizeClientMonth(rows,[],periods.current);assert.equal(r.total,1);assert.equal(r.excluded,2);
});
test("attribuisce al responsabile servizio senza usare l'autore del modulo",()=>{
 const r=summarizeClientMonth([client("1",{answers:{client_control_service_owner:"Laura Barreca"}}),client("2",{answers:{}})],[],periods.current);
 assert.deepEqual(r.staff.map(s=>s.name).sort(),["Laura Barreca","Senza responsabile"]);
});
test("mancante e approfondimento incompleto non sono risposte negative",()=>{
 const r=summarizeShiftMonth([q],{"2026-09-03":{q:"NO"},"2026-09-04":{old:"testo"},"2026-09-05":{q:"YES"}},periods.current);
 assert.equal(r.questionStats[0].no,1);assert.equal(r.questionStats[0].missing,1);assert.equal(r.questionStats[0].complete,1);assert.equal(r.legacyQuestions,1);assert.ok(Math.abs(r.completion! - 100/3) < 1e-8);
 assert.equal(summarizeShiftMonth([q],{},periods.previous).completion,null);
});
test("checkbox non selezionate restano separate dai No",()=>{
 const check={...q,answerType:"STAFF_CHECKLIST" as const,staffResponseMode:"CHECKBOXES" as const};
 const a=JSON.stringify({staffChecks:[{staffId:"1",name:"Laura",responses:{Divisa:"UNCHECKED",Capelli:"CHECKED",Altro:"NO"}}]});
 const r=summarizeShiftMonth([check],{"2026-09-03":{q:a}},periods.current);
 assert.equal(r.staff.reduce((s,r)=>s+r.no,0),0);assert.equal(r.staff.reduce((s,r)=>s+r.unselected,0),2);
});
