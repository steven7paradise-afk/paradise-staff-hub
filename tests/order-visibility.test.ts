import assert from "node:assert/strict";
import test from "node:test";
import { isOrderVisibleForOperationalLocation } from "../lib/order-visibility";

const buenosAiresId = "salone-buenos-aires";

test("mostra al salone gli ordini creati dall'ufficio", () => {
  assert.equal(isOrderVisibleForOperationalLocation({
    user_location_id: "ufficio-paradise",
    user_location_name: "Ufficio Paradise",
    user: {
      sede_id: "ufficio-paradise",
      location: { name: "Ufficio Paradise" },
    },
  }, buenosAiresId), true);
});

test("mostra gli ordini destinati alla sede anche quando li crea l'ufficio", () => {
  assert.equal(isOrderVisibleForOperationalLocation({
    user_location_id: buenosAiresId,
    user_location_name: "Salone Buenos Aires",
    user: {
      sede_id: "ufficio-paradise",
      location: { name: "Ufficio Paradise" },
    },
  }, buenosAiresId), true);
});

test("mantiene nascosti gli ordini di un'altra sede non creati dall'ufficio", () => {
  assert.equal(isOrderVisibleForOperationalLocation({
    user_location_id: "salone-duomo",
    user_location_name: "Salone Duomo",
    user: {
      sede_id: "salone-duomo",
      location: { name: "Salone Duomo" },
    },
  }, buenosAiresId), false);
});
