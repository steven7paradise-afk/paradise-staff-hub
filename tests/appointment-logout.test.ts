import test from "node:test";
import assert from "node:assert/strict";
import { endAppointmentWorkerSession } from "../lib/appointment-logout";

test("logout deletes server session before returning the salon chooser", async () => {
  const request = (async (url, init) => {
    assert.equal(url, "/api/appointments/pc/logout");
    assert.equal(init?.method, "POST");
    assert.equal(init?.credentials, "same-origin");
    return Response.json({redirectTo:"/appointments/buenos-aires?choose=1"});
  }) as typeof fetch;
  assert.equal(await endAppointmentWorkerSession(request), "/appointments/buenos-aires?choose=1");
});
test("logout failure is not treated as a successful local-only lock", async () => {
  await assert.rejects(endAppointmentWorkerSession((async () => new Response(null, {status:500})) as typeof fetch));
});
test("logout never redirects to an external destination", async () => {
  assert.equal(await endAppointmentWorkerSession((async () => Response.json({redirectTo:"https://example.org"})) as typeof fetch), null);
});
