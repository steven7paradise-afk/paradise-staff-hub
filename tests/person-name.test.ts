import assert from "node:assert/strict";
import test from "node:test";
import { formatPersonName } from "../lib/person-name";

test("uniforma nome e cognome con la sola iniziale maiuscola", () => {
  assert.equal(formatPersonName("MELISSA VALENTE"), "Melissa Valente");
  assert.equal(formatPersonName("  CHRISTINE   IOLANDA FIGUERO  "), "Christine Iolanda Figuero");
  assert.equal(formatPersonName("jessica Inturri"), "Jessica Inturri");
});

test("mantiene leggibili apostrofi, accenti e nomi con trattino", () => {
  assert.equal(formatPersonName("d'ANGELO maria-luisa"), "D'Angelo Maria-Luisa");
  assert.equal(formatPersonName("ÉLODIE D’AMICO"), "Élodie D’Amico");
});
