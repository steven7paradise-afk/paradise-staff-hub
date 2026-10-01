import test from "node:test";
import assert from "node:assert/strict";
import { clientControlParagraph, clientControlServiceSentence } from "../lib/client-control-summary";

test("riunisce le selezioni e le note in un solo paragrafo senza inventare valori", () => {
  assert.equal(clientControlParagraph("Servizi: Riapplicazione • Grammi: 150g • Fasce: 3\nNote: Cliente tranquilla"), "Servizi: Riapplicazione. Grammi: 150g. Fasce: 3. Note: Cliente tranquilla");
  assert.equal(clientControlParagraph("Note: Totale 25,50 €.\nDa verificare."), "Note: Totale 25,50 €. Da verificare.");
  assert.equal(clientControlParagraph(" \n "), "");
  assert.equal(clientControlParagraph("Servizi: Colore"), "Servizi: Colore");
});

test("la frase cresce a ogni selezione e si riduce quando una selezione viene tolta", () => {
  assert.equal(clientControlServiceSentence({}), "");
  assert.equal(clientControlServiceSentence({ services: ["Riapplicazione"] }), "Servizi: Riapplicazione.");
  assert.equal(clientControlServiceSentence({ services: ["Riapplicazione"], grammi: "150g" }), "Servizi: Riapplicazione con 150 g.");
  assert.equal(clientControlServiceSentence({ services: ["Riapplicazione"], grammi: "150g", lunghezza: "55cm", fasce: "3", atteggiamento: "Tranquilla" }), "Servizi: Riapplicazione con 150 g, lunghezza 55 cm e 3 fasce. La cliente è tranquilla.");
  assert.equal(clientControlServiceSentence({ services: ["Riapplicazione"], grammi: "", lunghezza: "55cm", fasce: "1" }), "Servizi: Riapplicazione con lunghezza 55 cm e 1 fascia.");
});

test("mantiene note, più servizi e valori personalizzati, senza inventare quantità", () => {
  assert.equal(clientControlServiceSentence({ services: ["Colore", "Piega"], extraNote: "Preferisce onde morbide." }), "Servizi: Colore e Piega. Preferisce onde morbide.");
  assert.equal(clientControlServiceSentence({ grammi: "250", fasce: "6" }), "Dettagli del servizio: 250 g e 6 fasce.");
  assert.equal(clientControlServiceSentence({ grammi: "custom", fasce: "custom", extraNote: "Solo nota" }), "Solo nota");
});
