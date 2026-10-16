import http from 'node:http';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {normalize,mergeReviews,verify,people} from './model.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));const port=Number(process.env.REVIEWS_PORT||4317);const csrf=randomBytes(24).toString('hex');
const storage=process.env.REVIEWS_DATA_DIR||path.join(root,'.local-data');let state={reviews:[],lastSync:null};
try{state=JSON.parse(await readFile(path.join(storage,'reviews.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
let busy=false;
async function save(next){await mkdir(storage,{recursive:true,mode:0o700});await writeFile(path.join(storage,'reviews.tmp'),JSON.stringify(next,null,2),{mode:0o600});await rename(path.join(storage,'reviews.tmp'),path.join(storage,'reviews.json'));state=next;}
function configured(){return Boolean(process.env.GBP_LOCATION&&((process.env.GBP_CLIENT_ID&&process.env.GBP_CLIENT_SECRET&&process.env.GBP_REFRESH_TOKEN)||process.env.GBP_ACCESS_TOKEN));}
async function googleReviews(){const location=process.env.GBP_LOCATION;if(!/^accounts\/[\w-]+\/locations\/[\w-]+$/.test(location||''))throw Error('Configura GBP_LOCATION con l’ID ufficiale della sede Buenos Aires.');let token=process.env.GBP_ACCESS_TOKEN;
 if(!token){const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:process.env.GBP_CLIENT_ID,client_secret:process.env.GBP_CLIENT_SECRET,refresh_token:process.env.GBP_REFRESH_TOKEN,grant_type:'refresh_token'}),signal:AbortSignal.timeout(20000)});if(!res.ok)throw Error('Collegamento Google scaduto o non autorizzato.');token=(await res.json()).access_token;}
 const all=[];let next='';const seen=new Set();do{const url=new URL(`https://mybusiness.googleapis.com/v4/${location}/reviews`);url.searchParams.set('pageSize','50');url.searchParams.set('orderBy','updateTime desc');if(next)url.searchParams.set('pageToken',next);const res=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});if(!res.ok)throw Error(`Google non ha completato l’importazione (HTTP ${res.status}). Nessun dato parziale salvato.`);const page=await res.json();all.push(...(page.reviews||[]).map(r=>normalize(r,'google')));next=page.nextPageToken||'';if(next&&seen.has(next))throw Error('Google ha restituito una pagina ripetuta. Riprova.');seen.add(next);}while(next);return all;}
const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
const server=http.createServer(async(req,res)=>{const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const host=req.headers.host;if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(host)){send(403,{error:'Solo localhost.'});return;}
 const url=new URL(req.url,`http://${host}`);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 try{
 if(req.method==='GET'&&files[url.pathname]){const f=files[url.pathname];res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(await readFile(path.join(root,'public',f)));return;}
 if(req.method==='GET'&&url.pathname==='/api/reviews'){send(200,{...state,people,csrf,googleConfigured:configured()});return;}
 if(req.method!=='POST'){send(404,{error:'Pagina non trovata.'});return;}
 if(req.headers.origin!==`http://${host}`||req.headers['x-review-token']!==csrf){send(403,{error:'Richiesta non autorizzata.'});return;}
 if(busy){send(409,{error:'Salvataggio in corso, riprova tra poco.'});return;}busy=true;
 try{let body='';for await(const c of req){body+=c;if(body.length>4_000_000)throw Error('File troppo grande (massimo 4 MB).');}const input=JSON.parse(body||'{}');
 if(url.pathname==='/api/import'||url.pathname==='/api/sync'){
  if(url.pathname==='/api/sync'&&!configured())throw Error('Google Business non è ancora collegato. Consulta “Collega Google”.');
  const raw=input.reviews;if(url.pathname==='/api/import'&&(!Array.isArray(raw)||raw.length>10000))throw Error('Serve un elenco di recensioni (massimo 10.000).');
  const incoming=url.pathname==='/api/sync'?await googleReviews():raw.map(r=>normalize(r,input.manual?'manual':'file'));
  const result=mergeReviews(state.reviews,incoming);await save({...state,reviews:result.reviews,lastSync:url.pathname==='/api/sync'?new Date().toISOString():state.lastSync});send(200,{added:result.added,updated:result.updated,total:incoming.length});return;
 }
 if(url.pathname==='/api/verify'){const review=state.reviews.find(r=>r.id===input.id);if(!review)throw Error('Recensione non trovata.');const changed=verify(review,input);await save({...state,reviews:state.reviews.map(r=>r.id===changed.id?changed:r)});send(200,{ok:true});return;}
 send(404,{error:'Operazione non trovata.'});
 }finally{busy=false;}
 }catch(e){send(400,{error:e.message||'Operazione non riuscita.'});}
});server.listen(port,'127.0.0.1',()=>console.log(`Recensioni Paradise: http://localhost:${port}`));
