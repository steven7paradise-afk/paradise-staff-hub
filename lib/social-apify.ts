import { prisma } from "@/lib/prisma";
import type { SocialChannel } from "./social-audience";
const HANDLE = "paradisebeauty.it";
const ACTORS = {INSTAGRAM:"apify~instagram-profile-scraper",FACEBOOK:"apify~facebook-pages-scraper",TIKTOK:"clockworks~tiktok-profile-scraper"};
export function parseApifyFollowers(channel: SocialChannel, rows: any[]): number {
  const row = rows.find(row => channel === "INSTAGRAM" ? row.username?.toLowerCase() === HANDLE : channel === "TIKTOK" ? row.authorMeta?.name?.toLowerCase() === HANDLE : row.pageName?.toLowerCase() === HANDLE);
  const count = channel === "INSTAGRAM" ? row?.followersCount : channel === "TIKTOK" ? row?.authorMeta?.fans : row?.followers;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) throw new Error("Profilo o conteggio non disponibile");
  return count;
}
async function apify(path: string, body?: unknown) {
  const response = await fetch(`https://api.apify.com/v2/${path}`,{method:body === undefined ? "GET":"POST",headers:{Authorization:`Bearer ${process.env.APIFY_API_TOKEN}`,"Content-Type":"application/json"},...(body === undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(12_000),cache:"no-store"});
  if(!response.ok) throw new Error("Apify non disponibile");
  return response.json();
}
export async function readApifyAudience(channel: SocialChannel) {
  const day = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Rome"}).format(new Date());
  const key = `social.apify.run.${day}.${channel}`;
  let run = await prisma.setting.findUnique({where:{key}});
  if(!run) {
    // A durable unique claim prevents multiple paid starts across users/processes.
    try {run = await prisma.setting.create({data:{key,value:{status:"STARTING"}}});}
    catch {return {state:"updating"};}
    try {
      const input = channel === "INSTAGRAM" ? {usernames:[HANDLE],includeAboutSection:false} : channel === "FACEBOOK" ? {startUrls:[{url:`https://www.facebook.com/${HANDLE}/`}]} : {profiles:[HANDLE],resultsPerPage:1,shouldDownloadVideos:false,shouldDownloadCovers:false,maxFollowersPerProfile:0,maxFollowingPerProfile:0};
      const result = await apify(`acts/${ACTORS[channel]}/runs?timeout=120&maxItems=1&maxTotalChargeUsd=0.03`, input);
      if(!result.data?.id) throw new Error("Nessun run ricevuto");
      run = await prisma.setting.update({where:{key},data:{value:{status:"RUNNING",id:result.data.id}}});
    } catch {
      await prisma.setting.update({where:{key},data:{value:{status:"FAILED"}}});
      return {state:"stale"};
    }
  }
  const data = run.value as {status:string;id?:string};
  if(data.status === "DONE") return {state:"connected"};
  if(data.status === "FAILED") return {state:"stale"};
  if(!data.id) return {state:"updating"};
  try {
    const result = await apify(`actor-runs/${encodeURIComponent(data.id)}`);
    if(["READY","RUNNING"].includes(result.data?.status)) return {state:"updating"};
    if(result.data?.status !== "SUCCEEDED" || !result.data.defaultDatasetId) throw new Error("Run non riuscito");
    const rows = await apify(`datasets/${encodeURIComponent(result.data.defaultDatasetId)}/items?clean=true&limit=5`);
    const count = parseApifyFollowers(channel,rows);
    const updatedAt = new Date().toISOString();
    const snapshotKey = `social.audience.${channel}`;
    await prisma.$transaction([
      prisma.setting.upsert({where:{key:snapshotKey},create:{key:snapshotKey,value:{count,updatedAt,provider:"apify"}},update:{value:{count,updatedAt,provider:"apify"}}}),
      prisma.setting.update({where:{key},data:{value:{status:"DONE",id:data.id}}}),
    ]);
    return {state:"connected",count,updatedAt};
  } catch {return {state:"stale"};}
}
