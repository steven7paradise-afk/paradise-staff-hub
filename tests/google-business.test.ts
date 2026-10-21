import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchReviewStaff } from '../lib/google-business/matching';
import { reviewPeriods, syncReviews, listReviews, reviewsSummary } from '../lib/google-business/reviews';
import { seal, unseal } from '../lib/google-business/oauth';
import { prisma } from '../lib/prisma';
const staff=[{id:'a',name:'Aurora Dassisti'},{id:'b',name:'Jessica Inturri'}];
function patch(t:any,obj:any,key:string,value:any){const old=obj[key];obj[key]=value;t.after(()=>obj[key]=old);}
function env(t:any){for(const [k,v] of Object.entries({GBP_ACCOUNT_EMAIL:'francesca@extensioncapelliveri.com',GBP_CLIENT_ID:'test',GBP_CLIENT_SECRET:'test',GBP_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')})){patch(t,process.env,k,v);}}
test('matches every distinct whole first name and leaves ambiguous names unassigned',()=>{
 assert.deepEqual(matchReviewStaff('Grazie AURORA!',staff),['a']);
 assert.deepEqual(matchReviewStaff('Jessica è bravissima',staff),['b']);
 assert.deepEqual(matchReviewStaff('Aurorale',staff),[]);
 assert.deepEqual(matchReviewStaff('Dassisti',staff),[]);
 assert.deepEqual(matchReviewStaff('Aurora e Jessica',staff),['a','b']);
 assert.deepEqual(matchReviewStaff('Aurora', [...staff,{id:'c',name:'Aurora Rossi'}]),[]);
});
test('Rome periods include DST and Monday boundary',()=>{
 assert.deepEqual(reviewPeriods(new Date('2026-10-25T23:30:00Z')),{today:'2026-10-26',week:'2026-10-26',month:'2026-10-01',end:'2026-10-27'});
});
test('tokens encrypted with authenticated encryption',t=>{
 env(t);const encrypted=seal({refresh_token:'PRIVATE_TOKEN'});
 assert.equal(encrypted.includes('PRIVATE_TOKEN'),false);assert.equal(unseal(encrypted).refresh_token,'PRIVATE_TOKEN');
 const parts=encrypted.split('.');const b=Buffer.from(parts[2],'base64');b[0]^=1;parts[2]=b.toString('base64');assert.throws(()=>unseal(parts.join('.')));
});
test('sync paginates, uses official totals, preserves manual assignments and never stores reviewer profiles',async t=>{
 env(t);const connection={location_name:'accounts/1/locations/2',tokens_encrypted:seal({refresh_token:'secret'})};
 patch(t,prisma.googleBusinessConnection,'findUniqueOrThrow',async()=>connection);
 patch(t,prisma.googleBusinessConnection,'findUnique',async()=>connection);
 patch(t,prisma.googleBusinessConnection,'updateMany',async()=>({count:1}));
 patch(t,prisma.user,'findMany',async(a:any)=>{assert.deepEqual(a.where.department_key,{in:['saloni','sarta']});assert.equal(a.where.active,true);return staff;});
 const writes:any[]=[],matches:any[]=[],deletes:any[]=[];
 patch(t,prisma,'$transaction',async(fn:any)=>fn({googleBusinessConnection:{updateMany:async(a:any)=>{assert.equal(a.data.total_reviews,200);assert.equal(a.data.average_rating,4.8);return {count:1};}},googleBusinessReview:{upsert:async(a:any)=>writes.push(a),updateMany:async(a:any)=>{matches.push(a);return {count:1};},deleteMany:async(a:any)=>deletes.push(a)},googleBusinessReviewStaff:{deleteMany:async()=>{},createMany:async(a:any)=>assert.equal(a.data[0].staff_id,'a')}}));
 let pages=0;patch(t,globalThis,'fetch',async(url:any)=>{
  if(String(url).includes('oauth2'))return Response.json({access_token:'token'});
  pages++;
  return Response.json({reviews:[{reviewId:String(pages),starRating:'FIVE',comment:'Grazie Aurora',reviewer:{displayName:'Pubblico',profilePhotoUrl:'PRIVATE_SENTINEL'},createTime:'2026-10-21T08:00:00Z',updateTime:'2026-10-21T08:00:00Z'}],averageRating:4.8,totalReviewCount:200,...(pages===1?{nextPageToken:'next'}:{})});
 });
 await syncReviews();assert.equal(pages,2);assert.equal(writes.length,2);assert.equal(JSON.stringify(writes).includes('PRIVATE_SENTINEL'),false);
 assert.ok(matches.every(m=>m.where.manual_match===false&&m.data.match_type==='testo'));
 assert.equal(deletes[0].where.id.notIn.length,2);
});
test('failed later page leaves previously stored snapshot untouched',async t=>{
 env(t);const connection={location_name:'accounts/1/locations/2',tokens_encrypted:seal({refresh_token:'secret'})};
 patch(t,prisma.googleBusinessConnection,'findUniqueOrThrow',async()=>connection);patch(t,prisma.googleBusinessConnection,'findUnique',async()=>connection);
 patch(t,prisma.googleBusinessConnection,'updateMany',async()=>({count:1}));
 patch(t,prisma,'$transaction',async()=>assert.fail('must not write partial results'));
 let page=0;patch(t,globalThis,'fetch',async(url:any)=>String(url).includes('oauth2')?Response.json({access_token:'token'}):++page===1?Response.json({reviews:[],averageRating:4,totalReviewCount:2,nextPageToken:'next'}):new Response('',{status:503}));
 await assert.rejects(syncReviews());
});
test('review listing projects only public fields and uses bounded pagination',async t=>{
 patch(t,prisma.googleBusinessConnection,'findUnique',async()=>({location_name:'accounts/1/locations/2'}));
 patch(t,prisma.googleBusinessReview,'findMany',async(a:any)=>{assert.equal(a.take,51);assert.equal(a.select.staff.select.staff.select.name,true);assert.deepEqual(a.where.id,{gt:'cursor'});return Array.from({length:51},(_,i)=>({id:String(i),rating:5,comment:null,reviewer_name:'Pubblico',created_at:new Date(),reply_text:null,staff:[],match_type:null}));});
 const result=await listReviews({cursor:'cursor'});assert.equal(result.reviews.length,50);assert.equal(result.next_cursor,'49');
});
test('summary uses official global aggregate and computed period aggregates',async t=>{
 patch(t,prisma.googleBusinessConnection,'findUnique',async()=>({location_name:'accounts/1/locations/2',average_rating:4.7,total_reviews:300,synced_at:new Date()}));
 patch(t,prisma.googleBusinessReview,'aggregate',async()=>({_count:0,_avg:{rating:null}}));
 const result=await reviewsSummary();assert.equal(result.average_rating,4.7);assert.equal(result.total_reviews,300);assert.deepEqual(result.today,{count:0,avg:null});
});

test('OAuth state is user-bound, expires and can only be consumed once', async t=>{
 const {consumeGoogleState}=await import('../lib/google-business/state');
 let row:any={user_id:'admin',verifier:'server-only-verifier',expires_at:new Date(Date.now()+60000)};let consumed=false;
 patch(t,prisma.googleBusinessOAuthState,'findUnique',async()=>row);
 patch(t,prisma.googleBusinessOAuthState,'deleteMany',async()=>({count:consumed?0:(consumed=true,1)}));
 assert.equal(await consumeGoogleState('x'.repeat(43),'other'),null);
 assert.equal(await consumeGoogleState('bad','admin'),null);
 assert.equal(await consumeGoogleState('x'.repeat(43),'admin'),'server-only-verifier');
 assert.equal(await consumeGoogleState('x'.repeat(43),'admin'),null);
 row.expires_at=new Date(0);assert.equal(await consumeGoogleState('x'.repeat(43),'admin'),null);
});
