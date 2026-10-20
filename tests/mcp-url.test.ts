import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { POST, GET, OPTIONS } from '../app/mcp/[token]/route';
import { prisma } from '../lib/prisma';
test('secret URL validates token, skips OAuth and Origin, serves SDK tools', async t => {
  process.env.MCP_ENABLED='true'; process.env.MCP_URL_TOKEN=randomBytes(48).toString('base64url');
  const old=prisma.$queryRaw; (prisma as any).$queryRaw=async()=>[{count:1}];
  t.after(()=>{prisma.$queryRaw=old;delete process.env.MCP_URL_TOKEN});
  const context=(token=process.env.MCP_URL_TOKEN!)=>({params:Promise.resolve({token})});
  const req=(method='GET',rpc?:object)=>new Request('https://test/mcp/redacted',{method,headers:{Origin:'https://arbitrary.example',Accept:'application/json, text/event-stream','Content-Type':'application/json'},...(rpc?{body:JSON.stringify(rpc)}:{})});
  for(const token of ['', 'wrong']) {const r=await GET(req(),context(token));assert.equal(r.status,404);assert.equal(r.headers.get('www-authenticate'),null);}
  assert.equal((await OPTIONS(req('OPTIONS'),context())).status,204);
  for(const [method,params] of [['initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}],['tools/list',{}]] as const) {
    const r=await POST(req('POST',{jsonrpc:'2.0',id:1,method,params}),context());assert.equal(r.status,200);assert.equal(r.headers.get('www-authenticate'),null);assert.equal(r.headers.get('set-cookie'),null);
    const body=await r.json();assert.ok(body.result);assert.equal(JSON.stringify(body).includes(process.env.MCP_URL_TOKEN!),false);
    if(method==='tools/list') {assert.equal(body.result.tools.length,6);for(const tool of body.result.tools)assert.equal(tool.annotations.readOnlyHint,true);}
  }
});
