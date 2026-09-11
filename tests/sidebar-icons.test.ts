import assert from "node:assert/strict";
import test from "node:test";
import { SIDEBAR_ICON_OPTIONS, isSidebarIconName } from "../lib/sidebar-icons";

test("accetta soltanto le icone disponibili nell'editor della sidebar", () => {
  assert.equal(isSidebarIconName("ClipboardCheck"), true);
  assert.equal(isSidebarIconName("Store"), true);
  assert.equal(isSidebarIconName("<script>"), false);
  assert.equal(new Set(SIDEBAR_ICON_OPTIONS.map((icon) => icon.name)).size, SIDEBAR_ICON_OPTIONS.length);
});
