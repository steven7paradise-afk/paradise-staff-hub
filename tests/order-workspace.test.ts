import assert from "node:assert/strict";
import test from "node:test";
import { getOrderTaskType, isOrderInWorkspace, orderStatusForWorkspace } from "../lib/order-workspace";

test("legacy and current operational answers keep their existing board classification", () => {
  const fixtures = [
    [{ order_items: "conversione_capelli" }, "conversione"],
    [{ field_1782212873121: "Conver. capelli cliente" }, "conversione"],
    [{ legacy: { name: "Conversione capelli" } }, "conversione"],
    [["Conversione capelli"], "conversione"],
    [{ legacy: { name: ["conversione"] } }, "conversione"],
    [{ legacy: { name: [[null, "conversione"]] } }, "conversione"],
    [{ legacy: { name: ["con", "ver"] } }, "altro"],
    [{ legacy: { name: [{ text: "conversione" }] } }, "altro"],
    [{ order_items: "Acquisto extension", option: "Accessorio" }, "accessori"],
    [{ order_items: "Nuove ext" }, "acquisto"],
    [{ order_items: "Controllo colore" }, "altro"],
    [{ photo: { url: "https://example.test/conversione.jpg" } }, "altro"],
    [{ conversione: "Controllo colore" }, "altro"],
    [{ order_items: "Acquisto", notes: "Conversione successiva" }, "conversione"],
  ] as const;
  for (const [answers, expected] of fixtures) assert.equal(getOrderTaskType({ answers }), expected);
});

test("the workspaces form a lossless partition without changing stored answers or statuses", () => {
  const orders = [
    { answers: { work: "conversione_capelli" }, status: "ORDERED" },
    { answers: { work: "Acquisto extension" }, status: "ORDERED" },
    { answers: { work: "Accessori" }, status: "NEW" },
    { answers: {}, status: "READY" },
  ];
  const before = structuredClone(orders);
  assert.equal(orders.filter((order) => isOrderInWorkspace(order, "conversions")).length, 1);
  assert.equal(orders.filter((order) => isOrderInWorkspace(order, "orders")).length, 3);
  for (const order of orders) assert.notEqual(isOrderInWorkspace(order, "orders"), isOrderInWorkspace(order, "conversions"));
  assert.equal(orderStatusForWorkspace("ORDERED", "conversions"), "PREPARING");
  assert.equal(orderStatusForWorkspace("ORDERED", "orders"), "ORDERED");
  for (const status of ["NEW", "PREPARING", "READY", "COMPLETED", "ARCHIVED"]) {
    assert.equal(orderStatusForWorkspace(status, "conversions"), status);
  }
  assert.equal(orderStatusForWorkspace(undefined, "conversions"), "NEW");
  assert.deepEqual(orders, before);
});
