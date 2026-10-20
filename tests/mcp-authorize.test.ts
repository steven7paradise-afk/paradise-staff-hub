import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { NextRequest } from 'next/server';
import { validRedirect } from '../lib/mcp/security';

// Bundle the real route with only session/database/rate-limit replaced; no real grants.
async function route(session: unknown, account: unknown) {
  (globalThis as any).__mcpAuthFixture = { session, account, tickets: [] };
  const result = await build({ entryPoints: ['app/oauth/authorize/route.ts'], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, plugins: [{ name: 'fixtures', setup(b) {
    b.onResolve({ filter: /^@\/lib\/(auth|prisma|mcp\/rate-limit)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path.endsWith('/auth') ? 'export async function auth(){return globalThis.__mcpAuthFixture.session}' : args.path.endsWith('/rate-limit') ? 'export async function consumeRate(){return true}' : `export const prisma={user:{findUnique:async()=>globalThis.__mcpAuthFixture.account},mcpClient:{findUnique:async({where})=>where.id==='registered'?{id:'registered',name:'Claude',redirect_uris:['https://claude.ai/api/mcp/auth_callback','https://claude.com/api/mcp/auth_callback']}:null},mcpAuthorization:{create:async({data})=>{globalThis.__mcpAuthFixture.tickets.push(data);return data}}};`, loader: 'js' }));
  }}] });
  const mod = { exports: {} as any };
  new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
  return mod.exports;
}
const query = () => new URLSearchParams({client_id:'registered',redirect_uri:'https://claude.ai/api/mcp/auth_callback',state:'original & state',code_challenge:'a'.repeat(43),code_challenge_method:'S256',scope:'staff:read',response_type:'code',resource:'https://www.staff-paradise.tech/mcp'});
const req = (q: URLSearchParams) => new NextRequest('https://www.staff-paradise.tech/oauth/authorize?'+q);
test('authorization browser flow preserves query, validates callbacks, and gives readable role errors', async () => {
  process.env.MCP_ENABLED='true';
  let api=await route(null,null); let q=query(); let r=await api.GET(req(q));
  assert.equal(r.status,307); const login=new URL(r.headers.get('location')!); assert.equal(login.pathname,'/login'); assert.equal(login.searchParams.get('callbackUrl'),'/oauth/authorize?'+q);
  const proxied = new NextRequest('http://0.0.0.0:3000/oauth/authorize?'+q,{headers:{'x-forwarded-host':'www.staff-paradise.tech','x-forwarded-proto':'https'}});
  r=await api.GET(proxied); assert.equal(new URL(r.headers.get('location')!).pathname,'/login');
  assert.equal(new URL(r.headers.get('location')!).searchParams.get('callbackUrl'),'/oauth/authorize?'+q);
  api=await route({user:{id:'admin'}},{id:'admin',active:true,role:'SUPER_ADMIN'});
  for (const callback of ['https://claude.ai/api/mcp/auth_callback','https://claude.com/api/mcp/auth_callback']) {q=query();q.set('redirect_uri',callback);r=await api.GET(req(q));assert.equal(r.status,200);assert.match(await r.text(),/Claude vuole leggere.*sola lettura/);assert.ok(r.headers.get('set-cookie'));}
  q=query();q.set('resource','https://www.staff-paradise.tech/mcp-admin');q.set('scope','staff:admin:read');r=await api.GET(req(q));assert.equal(r.status,200);assert.match(await r.text(),/Accesso amministratore/);
  api=await route({user:{id:'worker'}},{id:'worker',active:true,role:'STAFF'});r=await api.GET(req(query()));assert.equal(r.status,403);assert.match(r.headers.get('content-type')!,/text\/html/);const html=await r.text();assert.match(html,/account attualmente collegato non è amministratore/);assert.match(html,/error_description/);
  q=query();q.set('redirect_uri','https://evil.test/callback');r=await api.GET(req(q));assert.equal(r.status,400);assert.equal(r.headers.get('location'),null);
  q=query();q.set('client_id','unknown');r=await api.GET(req(q));assert.equal(r.status,400);assert.equal(r.headers.get('location'),null);
  q=query();q.delete('code_challenge');r=await api.GET(req(q));const back=new URL(r.headers.get('location')!);assert.equal(back.origin,'https://claude.ai');assert.equal(back.searchParams.get('error'),'invalid_request');assert.equal(back.searchParams.get('state'),q.get('state'));assert.ok(back.searchParams.get('error_description'));
});
test('DCR callback validator accepts Claude and Inspector loopback without arbitrary HTTP redirects',()=>{
 for(const uri of ['https://claude.ai/api/mcp/auth_callback','https://claude.com/api/mcp/auth_callback','http://127.0.0.1:6276/oauth/callback']) assert.equal(validRedirect(uri),true);
 for(const uri of ['http://evil.test/callback','http://127.0.0.1.evil.test/callback','https://claude.ai/api/mcp/auth_callback#fragment'])assert.equal(validRedirect(uri),false);
});
test('dynamic registration persists both Claude callbacks exactly', async t => {
  const { POST } = await import('../app/oauth/register/route');
  const { prisma } = await import('../lib/prisma');
  const oldCreate=prisma.mcpClient.create, oldQuery=prisma.$queryRaw;
  let stored: any;
  (prisma as any).$queryRaw=async()=>[{count:1}];
  (prisma.mcpClient as any).create=async({data}:any)=>{stored=data;return data};
  t.after(()=>{prisma.mcpClient.create=oldCreate;prisma.$queryRaw=oldQuery});
  const uris=['https://claude.ai/api/mcp/auth_callback','https://claude.com/api/mcp/auth_callback'];
  const r=await POST(new Request('https://www.staff-paradise.tech/oauth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_name:'Claude',redirect_uris:uris})}));
  assert.equal(r.status,201);assert.deepEqual(stored.redirect_uris,uris);assert.deepEqual((await r.json()).redirect_uris,uris);
});
