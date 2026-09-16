import assert from "node:assert/strict";
import { test } from "node:test";
import { confirmedShippingFulfillment, reconcileLocalShippingOrders, shippingPendingItems } from "../lib/shipping-pending-items";

const product = { id: 1, title: "2 - ALY - CASTANO SCURO", quantity: 2, fulfillable_quantity: 0, requires_shipping: true };
const deliveredOrder = {
  id: 100,
  fulfillment_status: "partial",
  line_items: [product, { id: 2, title: "Spedizione", quantity: 1, fulfillable_quantity: 1, requires_shipping: false }],
  fulfillments: [{ status: "success", shipment_status: "delivered", tracking_number: "example", line_items: [product] }],
};

test("a delivered product plus an open shipping fee is not an order to prepare", () => {
  assert.deepEqual(shippingPendingItems(deliveredOrder), []);
  assert.equal(shippingPendingItems(deliveredOrder, true)[0].quantity, 2);
  assert.equal(confirmedShippingFulfillment(deliveredOrder)?.shipment_status, "delivered");
});

test("only the remaining physical quantities are requested", () => {
  const items = shippingPendingItems({ line_items: [{ ...product, quantity: 4, fulfillable_quantity: 1 }] });
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 1);
  assert.equal(product.quantity, 2);
});

test("a freshly labeled product remains available until the shipment starts", () => {
  const order = { ...deliveredOrder, fulfillments: [{ ...deliveredOrder.fulfillments[0], shipment_status: null }] };
  assert.equal(shippingPendingItems(order)[0].quantity, 2);
  assert.equal(confirmedShippingFulfillment(order), null);
  order.fulfillments[0].shipment_status = "in_transit" as any;
  assert.deepEqual(shippingPendingItems(order), []);
  assert.deepEqual(shippingPendingItems({ ...order, cancelled_at: "2026-09-16" }), []);
});

test("an obsolete local draft cannot resurrect a delivered order", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ order: deliveredOrder });
  try {
    const orders: any[] = [];
    const inactive = await reconcileLocalShippingOrders(orders, [{ shopify_order_id: "100", status: "UNFULFILLED" }], "example.myshopify.com", "test");
    assert.equal(inactive.has("100"), false);
    assert.equal(orders.length, 1);
    assert.equal(confirmedShippingFulfillment(orders[0])?.shipment_status, "delivered");
  } finally { globalThis.fetch = originalFetch; }
});

test("an outage does not classify a local draft as shipped", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 503 });
  try {
    assert.equal((await reconcileLocalShippingOrders([], [{ shopify_order_id: "100", status: "PACKING" }], "example.myshopify.com", "test")).size, 0);
  } finally { globalThis.fetch = originalFetch; }
});
