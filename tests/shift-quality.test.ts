import test from "node:test";
import assert from "node:assert/strict";
import { hasReworkService, qualityAffectsPreviousBonus, QUALITY_CAUSES } from "../lib/shift-quality";
test("trova sistemazione fasce nei servizi e nelle sezioni dei lavoratori, non nelle note",()=>{
 assert.equal(hasReworkService({custom_services:["Applicazione","Sistemazione fasce"]}),true);
 assert.equal(hasReworkService({worker_service_sections:[{services:["Sistemazione fascie"]}]}),true);
 assert.equal(hasReworkService({client_control_notes:"forse una sistemazione fasce"}),false);
});
test("solo lavoro imputabile confermato e verificato può incidere sul precedente",()=>{
 for(const cause of QUALITY_CAUSES)assert.equal(qualityAffectsPreviousBonus({__qualityManaged:"true",__qualityConfirmed:"true",__qualityCause:cause},"2026-10-07T10:00:00Z"),cause==="Lavoro imputabile");
 assert.equal(qualityAffectsPreviousBonus({__qualityManaged:"true",__qualityConfirmed:"false",__qualityCause:"Lavoro imputabile"},"2026-10-07T10:00:00Z"),false);
 assert.equal(qualityAffectsPreviousBonus({__qualityManaged:"true",__qualityConfirmed:"true",__qualityCause:"Lavoro imputabile"},null),false);
 assert.equal(qualityAffectsPreviousBonus({__qualityManaged:"true",__qualityConfirmed:"true"},"2026-10-07T10:00:00Z"),false);
});
test("non riclassifica retroattivamente le righe storiche non gestite dal verbale",()=>{assert.equal(qualityAffectsPreviousBonus({}),true);});

test('non-attributable causes assign Staff Paradise and preserve original worker', async () => {
 const {applyQualityAttribution}=await import('../lib/shift-quality');
 for(const cause of ['Richiesta della cliente','Problema del prodotto','Normale usura']) {
  const values:Record<string,unknown>={previous:'Melissa Jaku'};
  applyQualityAttribution(values,'previous',cause);
  assert.equal(values.previous,'Staff Paradise');
  applyQualityAttribution(values,'previous','Lavoro imputabile');
  assert.equal(values.previous,'Melissa Jaku');
 }
});
