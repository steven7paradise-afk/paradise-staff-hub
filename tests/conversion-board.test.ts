import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ConversionBoardItem } from "../components/conversion-board";

const component = build({
  absWorkingDir: fileURLToPath(new URL("..", import.meta.url)),
  entryPoints: ["components/conversion-board.tsx"],
  bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
  plugins: [{ name: "board-css-fixture", setup(bundle) {
    bundle.onResolve({ filter: /\.module\.css$/ }, ({ path }) => ({ path, namespace: "css-fixture" }));
    bundle.onLoad({ filter: /.*/, namespace: "css-fixture" }, () => ({ contents: "export default new Proxy({}, {get: (_, key) => key});", loader: "js" }));
  } }],
}).then(result => {
  const componentModule = { exports: {} as typeof import("../components/conversion-board") };
  new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), componentModule, componentModule.exports);
  return componentModule.exports.ConversionBoard;
});

const item = (id: string, status: string): ConversionBoardItem => ({
  id, status, clientName: `Cliente ${id}`, reference: `#${id}`, description: "Conversione capelli",
  photoUrl: null, photoCount: 0, staffName: "Operatrice demo", dateLabel: "18 nov",
  deliveryLabel: "Ritiro in salone", overdue: false,
});

async function render(items: ConversionBoardItem[], canManage = true) {
  return renderToStaticMarkup(createElement(await component, {
    items, canManage, savingId: null, onOpen() {},
    async onAdvance() { assert.fail("Rendering the board must not perform a mutation"); },
  }));
}

test("Conversioni renders four compact workflow headings without an Ordered column", async () => {
  const html = await render([]);
  assert.deepEqual([...html.matchAll(/<h2>(.*?)<\/h2>/g)].map(match => match[1]), ["Da preparare", "In preparazione", "Pronto", "Consegnato"]);
  assert.equal([...html.matchAll(/Nessuna conversione in questo stato\./g)].length, 4);
  assert.match(html, /role="region" aria-label="Avanzamento conversioni"/);
});

test("read-only cards expose details without quick-advance or delivery mutations", async () => {
  const html = await render([item("new", "NEW"), item("preparing", "PREPARING"), item("ready", "READY")], false);
  assert.equal([...html.matchAll(/>Apri dettagli</g)].length, 3);
  assert.doesNotMatch(html, />Avvia<|>Segna pronta<|>Gestisci consegna</);
  assert.equal([...html.matchAll(/aria-label="Apri conversione /g)].length, 3);
});

test("legacy Ordered conversions stay visible in preparation with only the allowed next action", async () => {
  const legacy = item("legacy", "ORDERED");
  const html = await render([legacy, item("ready", "READY"), item("done", "COMPLETED")]);
  const sections = [...html.matchAll(/<section\b[^>]*aria-label="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)];
  const preparing = sections.find(section => section[1] === "In preparazione")?.[2] ?? "";
  assert.match(preparing, /Cliente legacy/);
  assert.match(preparing, />Segna pronta</);
  assert.match(html, />Gestisci consegna</);
  assert.equal(legacy.status, "ORDERED", "presentation must preserve the original stored status");
  assert.doesNotMatch(html, /<form\b/);
});
