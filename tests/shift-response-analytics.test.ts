import test from "node:test";
import assert from "node:assert/strict";
import { shiftAnswerDistribution } from "../lib/shift-response-analytics";
import type { ShiftResponsibleQuestion } from "../lib/shift-responsible-questions";
const q: ShiftResponsibleQuestion = { id: "q", title: "Problemi?", description: "", answerType: "YES_NO", followUpYes: "", followUpNo: "", yesLabel: "Presenti", noLabel: "Assenti" };
test("percentages exclude missing answers and preserve custom labels", () => {
 const result = shiftAnswerDistribution(q, [{q:"YES"},{q:"NO"},{}]);
 assert.equal(result.answered,2); assert.equal(result.missing,1);
 assert.deepEqual(result.options,[{label:"Presenti",count:1,percent:50},{label:"Assenti",count:1,percent:50}]);
});
test("checkboxes count each option once per responding day", () => {
 const result = shiftAnswerDistribution({...q,answerType:"CHECKBOXES"},[{q:'["A","A","B"]'},{q:'["B"]'}]);
 assert.equal(result.options.find(o=>o.label==="A")?.count,1);
 assert.equal(result.options.find(o=>o.label==="B")?.percent,100);
});
test("free text is counted without invented categories", () => {
 const result = shiftAnswerDistribution({...q,answerType:"TEXT"},[{q:"Una segnalazione"},{}]);
 assert.equal(result.answered,1); assert.deepEqual(result.options,[]);
});
