import assert from "node:assert/strict";
import test from "node:test";
import { calendarDaysBetween, shouldShowContractRenewalPopup } from "../lib/contract-renewal-reminders";

test("shows contract renewal choices 7, 3, 2 and 1 days before expiry", () => {
  for (const daysLeft of [7, 3, 2, 1]) {
    assert.equal(shouldShowContractRenewalPopup({ active: true, daysLeft, renewalStatus: "DA_VALUTARE" }), true);
  }
  assert.equal(shouldShowContractRenewalPopup({ active: true, daysLeft: 6, renewalStatus: "DA_VALUTARE" }), false);
  assert.equal(shouldShowContractRenewalPopup({ active: true, daysLeft: 4, renewalStatus: "DA_VALUTARE" }), false);
});

test("keeps expired contracts visible until they are marked as renewed", () => {
  assert.equal(shouldShowContractRenewalPopup({ active: true, daysLeft: 0, renewalStatus: "DA_VALUTARE" }), true);
  assert.equal(shouldShowContractRenewalPopup({ active: true, daysLeft: -1, renewalStatus: "NON_RINNOVATO" }), true);
  assert.equal(shouldShowContractRenewalPopup({ active: true, daysLeft: -20, renewalStatus: "RINNOVATO" }), false);
  assert.equal(shouldShowContractRenewalPopup({ active: false, daysLeft: -1, renewalStatus: "DA_VALUTARE" }), false);
});

test("calculates calendar-day distance without daylight-saving drift", () => {
  assert.equal(calendarDaysBetween("2026-03-28", "2026-03-31"), 3);
  assert.equal(calendarDaysBetween("2026-10-24", "2026-10-26"), 2);
});
