import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppointmentNoteDisclosure } from "../components/appointment-note-disclosure";

test("note disclosure retains the entire note including newlines and its final text", () => {
  const text = `${"Nota lunga. ".repeat(100)}\nUltima riga completa`;
  const html = renderToStaticMarkup(React.createElement(AppointmentNoteDisclosure, { text, label: "Nota ufficio" }));
  assert.ok(html.includes(text));
  assert.ok(html.includes("<details"));
  assert.ok(html.includes("<summary"));
  assert.ok(html.includes("Leggi tutta la nota"));
  assert.ok(html.includes("Riduci nota"));
  assert.ok(!html.includes("<details open"));
});

test("note content is escaped rather than interpreted as HTML", () => {
  const html = renderToStaticMarkup(React.createElement(AppointmentNoteDisclosure, {
    text: '<script>alert("nota")</script>', label: "Nota prenotazione",
  }));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});
