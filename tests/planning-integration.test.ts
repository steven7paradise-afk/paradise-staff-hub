import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { planningAuthorized, planningWebhookConfig, sendPlanningSnapshot } from "../lib/planning-integration-contract";
const secret = "test-only-secret-not-for-use-in-production";
test("integration is closed until configured and never accepts session credentials", () => {
  assert.equal(planningAuthorized(null, secret), false);
  assert.equal(planningAuthorized(`Bearer ${secret}`, undefined), false);
  assert.equal(planningAuthorized("Bearer short", "short"), false);
  assert.equal(planningAuthorized(`Bearer ${secret}x`, secret), false);
  assert.equal(planningAuthorized(`Bearer ${secret}`, secret), true);
  assert.equal(planningWebhookConfig({}), null);
  assert.equal(planningWebhookConfig({PLANNING_WEBHOOK_URL:'http://example.com',PLANNING_WEBHOOK_SECRET:secret}), null);
  assert.equal(planningWebhookConfig({PLANNING_WEBHOOK_URL:'https://user:pass@example.com',PLANNING_WEBHOOK_SECRET:secret}), null);
});
test("failed delivery retries with stable identity and verifiable signature", async () => {
  let calls = 0;
  const body = JSON.stringify({ revision: 42, data: { entries: [] } });
  const delivered = await sendPlanningSnapshot(body,42,{url:'https://example.com/webhook',secret}, async (_url,init) => {
    calls++;
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('x-planning-event-id'),'planning-42');
    assert.equal(init?.body,body);
    assert.equal(init?.redirect,'error');
    const expected = createHmac('sha256',secret).update(`${headers.get('x-planning-timestamp')}.${body}`).digest('hex');
    assert.equal(headers.get('x-planning-signature'),`sha256=${expected}`);
    return new Response(null,{status:calls===1?503:204});
  });
  assert.equal(delivered,true); assert.equal(calls,2);
});
test("permanent receiver errors stay pending without repeatedly sending", async () => {
  let calls=0;
  assert.equal(await sendPlanningSnapshot('{}',1,{url:'https://example.com',secret},async()=>{calls++;return new Response(null,{status:401});}),false);
  assert.equal(calls,1);
});
test("network failure is bounded and does not report successful delivery", async () => {
  let calls=0;
  assert.equal(await sendPlanningSnapshot('{}',1,{url:'https://example.com',secret},async()=>{calls++;throw new Error('offline');}),false);
  assert.equal(calls,3);
});

test("snapshot and retry HTTP routes reject unauthenticated requests before database access", async () => {
  const { NextRequest } = await import('next/server');
  const { GET } = await import('../app/api/integrations/planning/route');
  const { POST } = await import('../app/api/integrations/planning/retry/route');
  assert.equal((await GET(new NextRequest('http://localhost/api/integrations/planning'))).status,401);
  assert.equal((await POST(new NextRequest('http://localhost/api/integrations/planning/retry',{method:'POST'}))).status,401);
});
