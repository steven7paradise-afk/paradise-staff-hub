import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { GET, POST } from "../app/api/mobile/chat/calls/route";
import { chatDB as db } from "../lib/chat-db";
import { createMobileSession } from "../lib/mobile-auth";
async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "55439");
  const originalFetch = globalThis.fetch;
  const operations: string[] = [];
  globalThis.fetch = async (url) => { operations.push(String(url)); return new Response("{}", { status: 200 }); };
  const users = await Promise.all(["A", "B", "Admin"].map(name => db.user.create({ data: { name, email: `${randomUUID()}@example.invalid`, password_hash: "test-only", role: name === "Admin" ? "ADMIN" : "DIPENDENTE" } })));
  const tokens = await Promise.all(users.map(async u => (await createMobileSession(u.id)).token));
  const room = await db.chatRoom.create({ data: { title: "Test", kind: "direct", members: { create: users.slice(0,2).map(u => ({ userId: u.id })) } } });
  const req = (token: string, data?: object) => new NextRequest("https://localhost/api/mobile/chat/calls", { method: data ? "POST" : "GET", headers: { authorization: `Bearer ${token}` }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const post = (i: number, data: object) => POST(req(tokens[i], data));
  try {
    assert.equal((await GET(req("invalid"))).status, 401);
    process.env.CALLS_ENABLED = "false";
    assert.equal((await (await GET(req(tokens[0]))).json()).enabled, false);
    process.env.CALLS_ENABLED = "true";
    process.env.LIVEKIT_URL = "wss://calls.example.invalid";
    process.env.LIVEKIT_API_KEY = "test-key";
    process.env.LIVEKIT_API_SECRET = "test-secret-for-local-tests-only";
    const id = randomUUID(); const start = { action: "start", id, roomId: room.id };
    assert.equal((await post(2, start)).status, 404);
    assert.equal((await post(0, start)).status, 200);
    assert.equal((await post(0, start)).status, 200);
    assert.equal((await post(1, { ...start, id: randomUUID() })).status, 409);
    assert.equal((await post(0, { action: "accept", id })).status, 403);
    assert.equal((await post(2, { action: "join", id })).status, 404);
    assert.equal((await post(0, { action: "join", id })).status, 400);
    assert.equal((await post(1, { action: "accept", id })).status, 200);
    const joined = await (await post(0, { action: "join", id })).json();
    const payload = JSON.parse(Buffer.from(joined.token.split(".")[1], "base64url").toString());
    assert.equal(payload.sub, users[0].id); assert.equal(payload.video.room, id);
    assert.deepEqual(payload.video.canPublishSources, ["microphone"]); assert.equal(payload.video.canPublishData, false);
    assert.ok(payload.exp * 1000 - Date.now() <= 60000);
    assert.equal((await post(2, { action: "end", id })).status, 404);
    assert.equal((await post(1, { action: "end", id })).status, 200);
    assert.equal((await (await GET(req(tokens[0]))).json()).call, null);
    assert.equal((await post(0, { action: "join", id })).status, 410);
    assert.ok(operations.some(x => x.endsWith("/CreateRoom"))); assert.ok(operations.some(x => x.endsWith("/DeleteRoom")));
    console.log("PASS: authentication, membership, busy/idempotency, answer permissions, audio-only tokens, hang-up");
    await db.setting.deleteMany({ where: { key: { in: [`audio-call:${id}`, ...users.map(u => `audio-current:${u.id}`)] } } });
  } finally {
    globalThis.fetch = originalFetch;
    await db.chatRoom.delete({ where: { id: room.id } });
    await db.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
    await db.$disconnect();
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
