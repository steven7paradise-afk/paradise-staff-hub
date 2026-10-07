import test from "node:test";
import assert from "node:assert/strict";
import { dashboardDelaySummary, formatDelayMinutes, formatDelayCount } from "../lib/dashboard-delay-summary";
const date=new Date("2026-10-01");
const log=(type:string,time:string,note?:string)=>({date,type,timestamp:new Date(`2026-10-01T${time}:00+02:00`),note});
const shift={date,start_time:"10:00",end_time:"19:00",category:{code:"L",name:"Lavoro"}};
test("sum entry after grace and completed excess breaks, deduplicating shifts",()=>{
 const result=dashboardDelaySummary([log("ENTRATA","10:10"),log("PAUSA","13:00"),log("RIENTRO","14:05")],[shift,shift],"Buenos Aires",60);
 assert.deepEqual(result,{entryCount:1,breakCount:1,totalCount:2,entryMinutes:7,breakMinutes:5,totalMinutes:12});
});
test("ignore incomplete pauses, manual break corrections and entry within grace",()=>{
 const result=dashboardDelaySummary([log("ENTRATA","10:03"),log("PAUSA","13:00"),log("RIENTRO","14:20","Modificata manualmente da Admin"),log("PAUSA","16:00")],[shift],"Buenos Aires",60);
 assert.equal(result.totalMinutes,0);
 assert.equal(result.totalCount,0);
});
test("display hours and minutes without dropping excess minutes",()=>{
 assert.equal(formatDelayMinutes(85),"1 h 25 min");assert.equal(formatDelayMinutes(60),"1 h");assert.equal(formatDelayMinutes(0),"0 min");
});

test("format occurrence count in singular and plural",()=>{
 assert.equal(formatDelayCount(0),"0 ritardi");
 assert.equal(formatDelayCount(1),"1 ritardo");
 assert.equal(formatDelayCount(3),"3 ritardi");
});

test("corrected punctual entry ignores the historical detected time without masking another delay",()=>{
 const corrected=log("ENTRATA","09:57","Modificata manualmente da Admin - Ora rilevata 10:04:34; arrotondamento entrata Paradise a 10:00:00. - [CONTEGGIO_RITARDO_DA_TIMBRATURA_REALE]");
 const nextDate=new Date("2026-10-02");
 const uncorrected={date:nextDate,type:"ENTRATA",timestamp:new Date("2026-10-02T10:30:00+02:00"),note:"Timbratura tablet - Ora rilevata 10:12:06; arrotondamento entrata Paradise a 10:30:00."};
 const result=dashboardDelaySummary([corrected,uncorrected],[shift,{...shift,date:nextDate}],"Buenos Aires",60);
 assert.equal(result.entryCount,1);assert.equal(result.entryMinutes,9);
});

test("a corrected entry that is still late remains in the counter",()=>{
 const result=dashboardDelaySummary([log("ENTRATA","10:08","Modificata manualmente da Admin - Ora rilevata 10:20:00")],[shift],"Buenos Aires",60);
 assert.equal(result.entryCount,1);assert.equal(result.entryMinutes,5);
});
