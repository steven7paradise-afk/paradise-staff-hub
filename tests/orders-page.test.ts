import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as workspaceHelpers from "../lib/order-workspace";

function fixture() {
  const now = new Date("2026-11-18T10:00:00Z");
  const world = {
    access: { ok: true, session: { user: { id: "fixture-user", name: "Fixture" } }, isPC: true, role: "RESPONSABILE", canManageOrders: true, remoteWorker: null, remoteTarget: "", isAdminRemoteController: false, selectedPcWorker: null, operationalLocationId: "salon-a" } as Record<string, unknown>,
    linkedOrder: null as null | { id: string; answers: { order_items: string }; created_at: Date; updated_at: Date },
    responses: [] as Array<{ id: string; answers: { order_items: string }; created_at: Date; updated_at: Date }>,
    calls: [] as string[],
  };
  const order = (id: string, task: string) => ({ id, answers: { order_items: task }, created_at: now, updated_at: now });
  const dependencies: Record<string, unknown> = {
    "react/jsx-runtime": { jsx: (type: unknown, props: unknown, key: unknown) => ({ type, props, key }), jsxs: (type: unknown, props: unknown, key: unknown) => ({ type, props, key }) },
    "next/headers": { cookies: async () => ({}) },
    "next/navigation": { redirect: (href: string) => { throw new Error(`REDIRECT:${href}`); } },
    "@/components/app-shell": { AppShell: "AppShell" },
    "@/components/order-manager": { OrderManager: "OrderManager" },
    "@/lib/order-form": { ensureOrderForm: async () => { world.calls.push("ensure"); } },
    "@/lib/order-confirmation": { resolveOrderConfirmer: () => null },
    "@/lib/order-workspace-access": { resolveOrderWorkspaceAccess: async () => world.access },
    "@/lib/order-workspace": workspaceHelpers,
    "@/lib/order-workspace-store": {
      findOrderWorkspaceReference: async (reference: string, location: string) => { assert.equal(location, "salon-a"); world.calls.push(`find:${reference}`); return world.linkedOrder; },
      loadOrderWorkspace: async (workspace: string, location: string) => { assert.equal(location, "salon-a"); world.calls.push(`load:${workspace}`); return [...world.responses]; },
    },
    "@/lib/prisma": { prisma: { user: { findMany: async () => [] } } },
  };
  const exports: Record<string, unknown> = {};
  const code = ts.transpileModule(readFileSync("components/orders-page.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, URLSearchParams, require: (name: string) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unmocked dependency: ${name}`);
    return dependencies[name];
  } });
  const render = exports.OrdersPage as (props: { workspace: "orders" | "conversions"; searchParams: Promise<Record<string, string>> }) => Promise<{ props: { children: { key: string; props: { initialOrders: Array<{ id: string }>; workspace: string } } } }>;
  return { world, order, render };
}

test("both board pages fail closed before any order loading", async () => {
  const { world, render } = fixture();
  world.access = { ok: false, status: 401, redirectTo: "/login" };
  await assert.rejects(render({ workspace: "conversions", searchParams: Promise.resolve({}) }), /REDIRECT:\/login/);
  assert.deepEqual(world.calls, []);
});

test("old conversion links redirect to their board with aliases and remote filters preserved", async () => {
  for (const alias of ["ordine", "order", "orderId"]) {
    const { world, order, render } = fixture();
    world.linkedOrder = order("old-response", "Conversione capelli");
    const params = { [alias]: "25989", remoteTarget: "validated-controller", status: "READY" };
    await assert.rejects(render({ workspace: "orders", searchParams: Promise.resolve(params) }), (error: unknown) => {
      assert.ok(error instanceof Error);
      const url = new URL(error.message.replace("REDIRECT:", ""), "https://fixture.test");
      assert.equal(url.pathname, "/conversioni");
      for (const [key, value] of Object.entries(params)) assert.equal(url.searchParams.get(key), value);
      return true;
    });
    assert.equal(world.calls.some((call) => call.startsWith("load:")), false);
  }
});

test("an explicitly linked old conversion remains visible beyond the bounded recent board", async () => {
  const { world, order, render } = fixture();
  world.responses = [order("recent", "Conversione")];
  world.linkedOrder = order("old", "Conversione");
  const result = await render({ workspace: "conversions", searchParams: Promise.resolve({ ordine: "old" }) });
  assert.deepEqual(Array.from(result.props.children.props.initialOrders, (item) => item.id), ["old", "recent"]);
  assert.equal(result.props.children.key, "conversions");
  assert.equal(result.props.children.props.workspace, "conversions");
});

test("a reference outside the caller's location scope cannot be redirected or inserted", async () => {
  const { world, order, render } = fixture();
  world.responses = [order("own-order", "Acquisto")];
  const result = await render({ workspace: "orders", searchParams: Promise.resolve({ ordine: "other-salon" }) });
  assert.deepEqual(Array.from(result.props.children.props.initialOrders, (item) => item.id), ["own-order"]);
});
