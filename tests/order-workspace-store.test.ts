import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { Prisma } from "@prisma/client";
import { Client } from "pg";
import ts from "typescript";
import * as codeReader from "../lib/order-code-reader";
import * as workspaceHelpers from "../lib/order-workspace";
import * as visibility from "../lib/order-visibility";

// Explicit opt-in creates a private, empty local database. DATABASE_URL is never
// read and this fixture cannot connect to the application database.
const pgBin = process.env.ORDER_WORKSPACE_TEST_PG_BIN;

test("real PostgreSQL partitions before the 300-row cap, preserves scope and resolves old labels", { skip: !pgBin }, async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "order-workspace-pg-"));
  const data = path.join(directory, "data");
  const socket = path.join(directory, "socket");
  mkdirSync(socket);
  let started = false;
  let client: Client | undefined;
  try {
    execFileSync(path.join(pgBin!, "initdb"), ["-D", data, "--auth=trust", "--locale=C", "-E", "UTF8", "--no-instructions"], { stdio: "ignore" });
    execFileSync(path.join(pgBin!, "pg_ctl"), ["-D", data, "-l", path.join(directory, "postgres.log"), "-o", `-F -k ${socket} -h '' -p 55439`, "-w", "start"], { stdio: "ignore" });
    started = true;
    client = new Client({ host: socket, port: 55439, database: "postgres", user: process.env.USER || "socialparadise" });
    await client.connect();
    await client.query(`CREATE TABLE locations(id text PRIMARY KEY, name text);
      CREATE TABLE users(id text PRIMARY KEY, sede_id text);
      CREATE TABLE service_forms(id text PRIMARY KEY, category text, name text, fields jsonb);
      CREATE TABLE service_form_responses(id text PRIMARY KEY, form_id text, user_id text, user_location_id text, user_location_name text, answers jsonb, status text, created_at timestamp);
      INSERT INTO locations VALUES ('salon-a','Salon A'), ('salon-b','Salon B'), ('office','Ufficio Paradise');
      INSERT INTO users VALUES ('a','salon-a'), ('b','salon-b'), ('office','office');
      INSERT INTO service_forms VALUES ('orders','Ordini','Modulo Ordine','[{"id":"legacy_number","label":"Numero ordine"}]'), ('not-orders','Generale','Assenza','[]');`);

    const orders: Array<{ id: string; form_id: string; status: string; answers: Prisma.JsonValue; created_at: Date; user: { sede_id: string; location: { name: string } }; form: { fields: Prisma.JsonArray } }> = [];
    const add = async (id: string, answers: Prisma.JsonValue, user = "a", status = "NEW", formId = "orders", minute = 0) => {
      const created_at = new Date(Date.parse("2026-11-18T10:00:00Z") + minute * 60000);
      const sede_id = user === "office" ? "office" : `salon-${user}`;
      await client!.query("INSERT INTO service_form_responses VALUES ($1,$2,$3,NULL,NULL,$4,$5,$6)", [id, formId, user, JSON.stringify(answers), status, created_at]);
      orders.push({ id, form_id: formId, status, answers, created_at, user: { sede_id, location: { name: user === "office" ? "Ufficio Paradise" : `Salon ${user}` } }, form: { fields: [{ id: "legacy_number", label: "Numero ordine" }] } });
    };
    await add("old-conversion", { field_1782212873121: "Conversione capelli", legacy_number: "#25989" }, "a", "ORDERED");
    await add("office-conversion", { old_choice: { name: "CONVER capelli" } }, "office");
    await add("archived-conversion", { order_items: "Conversione" }, "a", "ARCHIVED");
    await add("unrelated-form", { order_items: "Conversione" }, "a", "NEW", "not-orders");
    for (let index = 0; index < 301; index++) {
      await add(`purchase-${index.toString().padStart(3, "0")}`, { order_items: "Acquisto extension" }, "a", "NEW", "orders", index + 1);
      await add(`foreign-${index.toString().padStart(3, "0")}`, { order_items: "conversione_capelli" }, "b", "NEW", "orders", index + 1);
    }
    await add("share-old", { order_items: "Conversione" }, "a", "NEW", "orders", -10);
    for (let index = 0; index < 25; index++) {
      await add(`share-newer-${index}`, { order_shopify_order: `900${index}`, order_title: "25989", order_items: "Acquisto" }, "a", "NEW", "orders", index + 1);
    }
    const parityAnswers: Prisma.JsonValue[] = [
      { task: "Conversione_capelli" }, { task: { name: "Conver. capelli" } },
      { task: "Accessori", notes: "Acquisto extension" }, { task: "Nuove ext" },
      { conversione: "Altro" }, { photo: { url: "https://fixture.test/conversione" } },
      { task: null }, { task: ["conversione"] }, { task: { name: { text: "conversione" } } },
      ["conversione capelli"], { task: { name: ["conversione"] } },
      { task: { name: [[null, "CONVERSIONE"]] } }, { task: { name: ["con", "ver"] } },
      { task: { name: [{ text: "conversione" }] } }, [["conversione"]],
    ];
    for (let index = 0; index < parityAnswers.length; index++) await add(`parity-${index}`, parityAnswers[index]);

    const dependencies: Record<string, unknown> = {
      "@prisma/client": { Prisma },
      "@/lib/order-code-reader": codeReader,
      "@/lib/order-workspace": workspaceHelpers,
      "@/lib/order-visibility": visibility,
      "@/lib/prisma": { prisma: {
        $queryRaw: async (query: Prisma.Sql) => (await client!.query(query.text, query.values)).rows,
        serviceFormResponse: { findMany: async ({ where, take }: { where: { id: { in: string[] } }; take: number }) => orders
          .filter((order) => where.id.in.includes(order.id) && order.status !== "ARCHIVED")
          .sort((a, b) => b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id))
          .slice(0, take) },
      } },
    };
    const exports: Record<string, unknown> = {};
    const code = ts.transpileModule(readFileSync("lib/order-workspace-store.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, { exports, require: (name: string) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unmocked dependency: ${name}`);
      return dependencies[name];
    } });
    const load = exports.loadOrderWorkspace as (workspace: workspaceHelpers.OrderWorkspace, location: string) => Promise<typeof orders>;
    const find = exports.findOrderWorkspaceReference as (reference: string, location: string) => Promise<typeof orders[number] | null>;
    for (const workspace of ["orders", "conversions"] as const) {
      const actual = await load(workspace, "salon-a");
      const expected = orders.filter((order) => order.form_id === "orders" && order.status !== "ARCHIVED"
        && visibility.isOrderVisibleForOperationalLocation(order, "salon-a") && workspaceHelpers.isOrderInWorkspace(order, workspace))
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id)).slice(0, 300);
      assert.deepEqual(Array.from(actual, (order) => order.id), expected.map((order) => order.id));
      assert.ok(actual.length <= 300);
    }
    assert.equal((await find("25989", "salon-a"))?.id, "old-conversion");
    assert.equal((await find("old-conversion", "salon-a"))?.id, "old-conversion");
    assert.equal((await find("https://fixture.test/o/25989", "salon-a"))?.id, "old-conversion");
    assert.equal((await find("SHARE", "salon-a"))?.id, "share-old");
    assert.equal(await find("old-conversion", "salon-b"), null);
    assert.equal(await find("archived-conversion", "salon-a"), null);
    assert.equal(await find("unrelated-form", "salon-a"), null);
    assert.equal(await find("' OR TRUE --", "salon-a"), null);
  } finally {
    await client?.end();
    if (started) execFileSync(path.join(pgBin!, "pg_ctl"), ["-D", data, "-m", "immediate", "-w", "stop"], { stdio: "ignore" });
    rmSync(directory, { recursive: true, force: true });
  }
});
