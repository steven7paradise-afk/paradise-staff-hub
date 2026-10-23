import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { DateKey } from './schemas';
import { addDays, dayStart, romeIso } from './time';
import { McpError } from './permissions';

const text = z.string().nullable();
const attributes = { code:z.string(), color:text, type:text, grams:z.number().nullable() };
const pageSize = 100;
const cursorSchema = z.object({
  from:DateKey, to:DateKey, date:z.string().datetime(), id:z.string().min(1).max(100),
}).strict();
const productSelect = { id:true, sku:true, category:true, minimum_stock:true } as const;

// Do not reuse getInventoryOverview: it creates/updates locations on reads.
export async function listInventory() {
  const [products, counts, locations] = await Promise.all([
    prisma.inventoryProduct.findMany({select:productSelect,orderBy:{id:'asc'}}),
    prisma.inventoryLabel.groupBy({by:['product_id','location_id'],where:{status:{in:['AVAILABLE','RESERVED']}},_count:{_all:true}}),
    prisma.inventoryLocation.findMany({select:{id:true,code:true}}),
  ]);
  const names = new Map(locations.map(l=>[l.id,l.code]));
  const grouped = new Map<string, typeof counts>();
  for (const count of counts) grouped.set(count.product_id,[...(grouped.get(count.product_id)||[]),count]);
  return {items:products.flatMap(p=>{
    const base = {id:p.id,code:p.sku,color:null,type:p.category,length_cm:null,grams:null,min_stock:p.minimum_stock};
    const rows = grouped.get(p.id)||[];
    return rows.length ? rows.sort((a,b)=>a.location_id.localeCompare(b.location_id)).map(row=>({
      ...base,quantity:row._count._all,location:names.get(row.location_id)||null,
    })) : [{...base,quantity:0,location:null}];
  })};
}

export async function listInventoryMovements(args:{from:string;to:string;cursor?:string}) {
  const from=DateKey.parse(args.from), to=DateKey.parse(args.to);
  if(from>to) throw new McpError('invalid_request','from deve precedere to.');
  let after:z.infer<typeof cursorSchema>|undefined;
  if(args.cursor){
    try{
      if(args.cursor.length>1000||!/^[A-Za-z0-9_-]+$/.test(args.cursor))throw Error();
      after=cursorSchema.parse(JSON.parse(Buffer.from(args.cursor,'base64url').toString('utf8')));
      if(after.from!==from||after.to!==to||new Date(after.date)<dayStart(from)||new Date(after.date)>=dayStart(addDays(to,1)))throw Error();
    }catch{throw new McpError('invalid_request','Cursore non valido per questo intervallo.');}
  }
  const rows=await prisma.inventoryMovement.findMany({
    where:{created_at:{gte:dayStart(from),lt:dayStart(addDays(to,1))},...(after?{OR:[
      {created_at:{lt:new Date(after.date)}},
      {created_at:new Date(after.date),id:{lt:after.id}},
    ]}:{})},
    select:{id:true,created_at:true,product_id:true,movement_type:true,user_id:true,product:{select:{sku:true,category:true}}},
    orderBy:[{created_at:'desc'},{id:'desc'}],take:pageSize+1,
  });
  const selected=rows.slice(0,pageSize),last=selected.at(-1);
  return {
    movements:selected.map(r=>({
      id:r.id,date:romeIso(r.created_at),item_id:r.product_id,code:r.product.sku,
      color:null,type:r.product.category,grams:null,
      // Each movement concerns one labelled unit. Historic adjustments do not
      // record before/after status: current label status cannot recover the delta.
      quantity:r.movement_type==='IN'||r.movement_type==='RETURN'?1:
        r.movement_type==='OUT'||r.movement_type==='DAMAGED'?-1:
        r.movement_type==='TRANSFER'?0:null,
      reason:r.movement_type==='IN'?'carico':r.movement_type==='OUT'?'vendita':r.movement_type==='RETURN'?'reso':'rettifica',
      employee_id:r.user_id,
      // Free-text source notes may contain customer identities. Never select them.
      note:r.movement_type==='TRANSFER'?'Trasferimento interno: giacenza totale invariata.':
        r.movement_type==='ADJUSTMENT'?'Variazione storica non registrata.':
        r.movement_type==='DAMAGED'?'Unità danneggiata.':null,
    })),
    next_cursor:rows.length>pageSize&&last?Buffer.from(JSON.stringify({from,to,date:last.created_at.toISOString(),id:last.id})).toString('base64url'):null,
  };
}

type Register = (name:string,description:string,input:z.ZodRawShape,output:z.ZodRawShape,run:(args:any)=>Promise<unknown>)=>void;
export function registerInventoryTools(tool:Register) {
  tool('list_inventory','Solo super admin. Giacenza per articolo e sede (location = codice sede), unità AVAILABLE + RESERVED. Lo stesso id articolo può comparire in più sedi; min_stock è la soglia globale articolo. Articoli senza stock: quantity 0 e location null. Colore, lunghezza e grammi non strutturati: null. Sola lettura, nessun dato cliente.',{},
    {items:z.array(z.object({id:z.string(),...attributes,length_cm:z.number().nullable(),quantity:z.number().int().nonnegative(),location:text,min_stock:z.number().int()}))},listInventory);
  tool('list_inventory_movements','Solo super admin. from/to: YYYY-MM-DD inclusivi Europe/Rome. 100 movimenti per pagina, dal più recente; riutilizzare next_cursor con lo stesso intervallo. Quantità in unità: carico/reso +1, vendita/danno -1, trasferimento interno 0 (rettifica), rettifiche storiche null perché prive di delta. Uso in salone non distinto nella fonte. Colore/grammi null; note solo spiegazioni tecniche, mai note libere o dati cliente.',
    {from:DateKey,to:DateKey,cursor:z.string().min(1).max(1000).optional()},
    {movements:z.array(z.object({id:z.string(),date:z.string(),item_id:z.string(),...attributes,quantity:z.number().int().nullable(),reason:z.enum(['carico','vendita','uso in salone','reso','rettifica']),employee_id:z.string(),note:text})),next_cursor:text},listInventoryMovements);
}
