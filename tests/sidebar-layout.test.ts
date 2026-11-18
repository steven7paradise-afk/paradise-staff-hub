import assert from "node:assert/strict";
import test from "node:test";
import { resolveSidebarLayout } from "../lib/sidebar-layout";

test("la stessa pagina può essere assegnata a più mansioni", () => {
  const layout = {
    default: [],
    targets: {
      parrucchiera: [{ id: "salone", title: "Salone", routes: ["/appointments"] }],
      assistenza: [{ id: "clienti", title: "Clienti", routes: ["/appointments"] }],
    },
  };

  assert.deepEqual(resolveSidebarLayout(layout, "DIPENDENTE", "Parrucchiera")?.[0].routes, ["/appointments"]);
  assert.deepEqual(resolveSidebarLayout(layout, "DIPENDENTE", "Assistenza")?.[0].routes, ["/appointments"]);
});

test("un menu mansione vuoto resta vuoto e non eredita quello generale", () => {
  const layout = {
    default: [{ id: "base", title: "Base", routes: ["/dashboard"] }],
    targets: { stagista: [] },
  };

  assert.deepEqual(resolveSidebarLayout(layout, "DIPENDENTE", "Stagista"), []);
});

test("le vecchie sezioni Il mio lavoro diventano personali", () => {
  const result = resolveSidebarLayout([
    { id: "mine", title: "Il mio lavoro", routes: ["/my-shifts"] },
  ], "DIPENDENTE", "Parrucchiera");

  assert.equal(result?.[0].area, "PERSONALE");
});

test("saved role and mansione menus place Conversioni beside Ordini without changing the source config", () => {
  const original = {
    default: [{ id: "planning", title: "Planning", routes: ["/schedules", "/orders", "/barcode-labels"] }],
    targets: { sarta: [{ id: "work", title: "Lavoro", routes: ["/orders"] }] },
  };
  const snapshot = structuredClone(original);
  assert.deepEqual(resolveSidebarLayout(original, "ADMIN")?.[0].routes, ["/schedules", "/orders", "/conversioni", "/barcode-labels"]);
  assert.deepEqual(resolveSidebarLayout(original, "DIPENDENTE", "Sarta")?.[0].routes, ["/orders", "/conversioni"]);
  assert.deepEqual(original, snapshot);
});

test("an explicitly placed Conversioni item is preserved once and menus without Ordini stay unchanged", () => {
  const layout = [
    { id: "orders", title: "Ordini", routes: ["/orders"] },
    { id: "conversions", title: "Conversioni", routes: ["/conversioni"] },
  ];
  const resolved = resolveSidebarLayout(layout, "ADMIN")!;
  assert.deepEqual(resolved.map((folder) => folder.routes), [["/orders"], ["/conversioni"]]);
  assert.deepEqual(resolveSidebarLayout([{ id: "work", title: "Lavoro", routes: ["/appointments"] }], "DIPENDENTE")?.[0].routes, ["/appointments"]);
});
