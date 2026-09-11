import assert from "node:assert/strict";
import test from "node:test";
import { isServiceFormFieldVisible } from "../lib/service-form-visibility";

test("a conditional required field is hidden when its branch was not selected", () => {
  const field = {
    show_if: {
      field_id: "action",
      operator: "equals",
      value: "acquista di nuove extension",
    },
  };

  assert.equal(isServiceFormFieldVisible(field, { action: "accessori" }), false);
});

test("a conditional field is visible when its branch was selected", () => {
  const field = {
    show_if: {
      field_id: "action",
      operator: "equals",
      value: "acquista di nuove extension",
    },
  };

  assert.equal(
    isServiceFormFieldVisible(field, { action: "Acquista di nuove extension" }),
    true,
  );
});

test("an empty expected value means the source field must contain a value", () => {
  const field = {
    show_if: { field_id: "grams", operator: "equals", value: "" },
  };

  assert.equal(isServiceFormFieldVisible(field, { grams: "" }), false);
  assert.equal(isServiceFormFieldVisible(field, { grams: "100" }), true);
});

test("multiple conditions use the same OR behavior as the form UI", () => {
  const field = {
    show_ifs: [
      { field_id: "payment", operator: "equals", value: "bonifico" },
      { field_id: "payment", operator: "equals", value: "contanti" },
    ],
  };

  assert.equal(isServiceFormFieldVisible(field, { payment: "Contanti" }), true);
  assert.equal(isServiceFormFieldVisible(field, { payment: "Carta" }), false);
});
