import assert from "node:assert/strict";
import test from "node:test";
import { PROFESSIONAL_LEVELS, readProfessionalLevel, withProfessionalLevel } from "../lib/professional-level";

test("salva e rilegge i livelli mantenendo i dati contrattuali", () => {
  const previous = { contractType: "Indeterminato", contractRenewalStatus: "DA_VALUTARE", exEmployeeSince: "2026-01-01" };
  for (const level of PROFESSIONAL_LEVELS) {
    const saved = withProfessionalLevel(previous, level);
    assert.equal(readProfessionalLevel(JSON.parse(JSON.stringify(saved))), level);
    assert.deepEqual(saved, { ...previous, professionalLevel: level });
  }
  assert.equal(readProfessionalLevel(previous), "");
});

test("un aggiornamento estraneo mantiene il livello, Non specificato lo rimuove", () => {
  const previous = { contractType: "Indeterminato", professionalLevel: "Master" };
  assert.deepEqual(withProfessionalLevel(previous, undefined), previous);
  for (const empty of ["", null]) {
    const saved = withProfessionalLevel(previous, empty);
    assert.deepEqual(saved, { contractType: "Indeterminato" });
    assert.equal(readProfessionalLevel(saved), "");
  }
  assert.equal(previous.professionalLevel, "Master");
});

test("i profili senza dati restano non specificati e i valori non ammessi vengono rifiutati", () => {
  assert.equal(readProfessionalLevel(null), "");
  assert.equal(readProfessionalLevel({ professionalLevel: "Altro" }), "");
  for (const value of ["Altro", 1, true, {}, ["Master"]]) {
    assert.throws(() => withProfessionalLevel(null, value), /Livello professionale non valido/);
  }
});
