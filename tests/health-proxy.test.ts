import test from "node:test";
import assert from "node:assert/strict";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config } from "../proxy";

test("liveness bypasses session processing while protected routes retain the proxy", () => {
  for (const url of ["/api/health", "/api/health?probe=1", "/api/health/"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }), false, url);
  }
  for (const url of ["/dashboard", "/attendance", "/api/staff", "/api/health-records"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }), true, url);
  }
});
