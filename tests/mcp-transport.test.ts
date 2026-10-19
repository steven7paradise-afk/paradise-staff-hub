import { test } from "node:test";
import assert from "node:assert/strict";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createOfficeServer } from "../lib/mcp/server";
const fixture: any = { meta: { generated_at: "2026-10-19T09:00:00+02:00", timezone: "Europe/Rome", data_notes: [] }, departments: [], employees: [{ id: "employee", name: "Test", role: "Operatore", department_key: "ecom", is_department_lead: false, status: "non_timbrato", checked_in_at: null, checked_out_at: null, current_task: null, open_tasks_count: 0, overdue_tasks_count: 0 }], tasks: [], projects: [], attendance: [{ employee_id: "employee", status: "non_timbrato", checked_in_at: null, checked_out_at: null, worked_minutes: 0, breaks: [] }], history: () => [] };
async function rpc(method: string, params: object = {}, load: any = async () => fixture) {
  const server = createOfficeServer({ user_id: "test", client_id: "test" }, load);
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  try { await server.connect(transport); const response = await transport.handleRequest(new Request("https://test/mcp", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-11-25" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })); return { status: response.status, body: await response.json() }; }
  finally { await server.close(); }
}
test("official SDK serves initialize, six read-only tools and declared output schemas", async () => {
  const init = await rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } });
  assert.equal(init.status, 200); assert.equal(init.body.result.serverInfo.name, "paradise-staff-hub");
  const { body } = await rpc("tools/list"); assert.equal(body.result.tools.length, 6);
  for (const tool of body.result.tools) { assert.equal(tool.annotations.readOnlyHint, true); assert.equal(tool.annotations.destructiveHint, false); assert.equal(tool.outputSchema.type, "object"); }
});
test("all tools return identical structured JSON and text and call the live loader each time", async () => {
  let reads = 0;
  for (const name of ["get_office_summary", "list_employees", "get_employee", "get_attendance", "list_tasks", "list_projects"]) {
    const { body } = await rpc("tools/call", { name, arguments: name === "get_employee" ? { employee_id: "employee" } : {} }, async () => { reads++; return fixture; });
    assert.equal(body.result.isError, undefined, JSON.stringify(body));
    assert.deepEqual(JSON.parse(body.result.content[0].text), body.result.structuredContent);
  }
  assert.equal(reads, 6);
});
test("invalid arguments and unavailable employees never leak internal exceptions", async () => {
  const invalid = await rpc("tools/call", { name: "get_attendance", arguments: { date: "2026-02-30" } }); assert.ok(invalid.body.result?.isError || invalid.body.error);
  const failure = await rpc("tools/call", { name: "get_office_summary", arguments: {} }, async () => { throw Error("private-data-sentinel"); });
  assert.equal(failure.body.result.isError, true); assert.equal(JSON.stringify(failure).includes("private-data-sentinel"), false);
  const missing = await rpc("tools/call", { name: "get_employee", arguments: { employee_id: "not-visible" } }); assert.equal(missing.body.result.isError, true);
});
