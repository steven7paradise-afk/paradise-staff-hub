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
