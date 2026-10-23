import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WebStandardStreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {createAdminServer} from '../lib/mcp/admin';
import {prisma} from '../lib/prisma';
import {listInventoryMovements} from '../lib/mcp/inventory';
function patch(t:any,target:any,key:string,fn:any){const old=target[key];target[key]=fn;t.after(()=>target[key]=old);}
async function rpc(name:string,args:object={}) {
 const server=createAdminServer({user_id:'admin',client_id:'test'});
 const transport=new WebStandardStreamableHTTPServerTransport({enableJsonResponse:true});
 try{await server.connect(transport);return await (await transport.handleRequest(new Request('https://test/mcp-admin',{
  method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},
  body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}),
 }))).json();}finally{await server.close();}
}
test('inventory tools recheck super-admin access and omit source notes and personal fields',async t=>{
 let role='ADMIN',active=true,reads=0;
 patch(t,prisma.user,'findUnique',async()=>({role,active}));
 patch(t,prisma.setting,'findUnique',async()=>null);
 patch(t,prisma.inventoryProduct,'findMany',async(a:any)=>{reads++;assert.deepEqual(Object.keys(a.select).sort(),['category','id','minimum_stock','sku']);return [{id:'p',sku:'CODE',category:'Clip',minimum_stock:2,description:'PRIVATE_SENTINEL'}];});
 patch(t,prisma.inventoryLabel,'groupBy',async(a:any)=>{assert.deepEqual(a.where.status.in,['AVAILABLE','RESERVED']);return [{product_id:'p',location_id:'l',_count:{_all:4}}];});
 patch(t,prisma.inventoryLocation,'findMany',async()=>[{id:'l',code:'CENTRALE'}]);
 patch(t,prisma.inventoryMovement,'findMany',async(a:any)=>{
  reads++;assert.equal(a.select.notes,undefined);assert.equal(a.select.user,undefined);assert.equal(a.select.label,undefined);
  return ['IN','OUT','RETURN','TRANSFER','DAMAGED','ADJUSTMENT'].map((type,i)=>({id:String(i),created_at:new Date('2026-10-25T12:00:00Z'),product_id:'p',movement_type:type,user_id:'employee',product:{sku:'CODE',category:'Clip'},notes:'PRIVATE_SENTINEL'}));
 });
 for(const name of ['list_inventory','list_inventory_movements']){
  for(const deniedRole of ['ADMIN','RESPONSABILE','DIPENDENTE']){role=deniedRole;const r=await rpc(name,name==='list_inventory'?{}:{from:'2026-10-25',to:'2026-10-25'});assert.equal(JSON.parse(r.result.content[0].text).error,'forbidden');}
 }
 assert.equal(reads,0);role='SUPER_ADMIN';
 const stock=await rpc('list_inventory');assert.equal(stock.result.isError,undefined);
 assert.deepEqual(stock.result.structuredContent.items,[{id:'p',code:'CODE',color:null,type:'Clip',grams:null,length_cm:null,quantity:4,location:'CENTRALE',min_stock:2}]);
 const movements=await rpc('list_inventory_movements',{from:'2026-10-25',to:'2026-10-25'});
 assert.equal(movements.result.isError,undefined);
 assert.deepEqual(movements.result.structuredContent.movements.map((r:any)=>r.quantity),[1,-1,1,0,-1,null]);
 for(const r of [stock,movements]){assert.equal(JSON.stringify(r).includes('PRIVATE_SENTINEL'),false);assert.deepEqual(JSON.parse(r.result.content[0].text),r.result.structuredContent);}
 active=false;assert.equal(JSON.parse((await rpc('list_inventory')).result.content[0].text).error,'forbidden');
});
test('movement pagination preserves date/id boundary, interval binding, Rome DST and rejects malformed inputs',async t=>{
 let calls=0;
 patch(t,prisma.inventoryMovement,'findMany',async(a:any)=>{
  calls++;
  assert.equal(a.where.created_at.gte.toISOString(),'2026-10-24T22:00:00.000Z');
  assert.equal(a.where.created_at.lt.toISOString(),'2026-10-25T23:00:00.000Z');
  assert.deepEqual(a.orderBy,[{created_at:'desc'},{id:'desc'}]);assert.equal(a.take,101);
  if(calls===2){assert.equal(a.where.OR[1].id.lt,'id-099');return [];}
  return Array.from({length:101},(_,i)=>({id:`id-${String(i).padStart(3,'0')}`,created_at:new Date('2026-10-25T12:00:00Z'),product_id:'p',movement_type:'IN',user_id:'e',product:{sku:'S',category:null}}));
 });
 const range={from:'2026-10-25',to:'2026-10-25'};
 const first=await listInventoryMovements(range);assert.equal(first.movements.length,100);assert.ok(first.next_cursor);
 const last=await listInventoryMovements({...range,cursor:first.next_cursor!});assert.equal(last.next_cursor,null);
 for(const args of [{...range,cursor:'!!!'},{...range,to:'2026-10-26',cursor:first.next_cursor!},{...range,to:'2026-10-24'},{...range,from:'2026-02-30'}])await assert.rejects(()=>listInventoryMovements(args));
 assert.equal(calls,2);
});
