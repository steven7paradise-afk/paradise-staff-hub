import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

test("PC registration dialog is included in the reachable appointment workspace", () => {
  const source = readFileSync("components/appointments-browser.tsx", "utf8");
  const tree = ts.createSourceFile("appointments.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let workspaceReturn = "";
  function visit(node: ts.Node) {
    if (ts.isReturnStatement(node) && node.expression) {
      const body = node.expression.getText(tree);
      if (body.includes('className="appointments-workspace w-full"')) workspaceReturn = body;
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(workspaceReturn, "active workspace return must exist");
  assert.ok(workspaceReturn.includes("{pcGenModalOpen && ("), "dialog must not be left after an unconditional return");
  assert.ok(workspaceReturn.includes('onSubmit={handleGeneratePcLink}'));
  assert.equal(source.split("{pcGenModalOpen && (").length - 1, 1);
});
