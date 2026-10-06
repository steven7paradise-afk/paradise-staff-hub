import { prisma } from "@/lib/prisma";
import { readApifyAudience } from "./social-apify";

export const SOCIAL_CHANNELS = ["FACEBOOK", "INSTAGRAM", "TIKTOK"] as const;
export type SocialChannel = typeof SOCIAL_CHANNELS[number];
export const canManageSocialGoals = (role: string) => ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(role);
export function validSocialGoal(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 10_000_000_000);
}
export function followerCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid follower count");
  return value;
}
const inflight = new Map<SocialChannel, Promise<unknown>>();
async function readChannel(channel: SocialChannel) {
  const [snapshot, goal] = await Promise.all([
    prisma.setting.findUnique({where:{key:`social.audience.${channel}`}}),
    prisma.setting.findUnique({where:{key:`social.goal.${channel}`}}),
  ]);
  const saved = snapshot?.value as {count?:number;updatedAt?:string;checkedAt?:string} | undefined;
  const target = goal?.value as {target?:number} | undefined;
  const base = {channel,target:target?.target ?? null,count:saved?.count ?? null,updatedAt:saved?.updatedAt ?? null};
  if (!process.env.APIFY_API_TOKEN) return {...base,state:"disconnected"};
  return {...base,...await readApifyAudience(channel)};
}
export async function getSocialAudience() {
  return Promise.all(SOCIAL_CHANNELS.map(async channel => {
    if (inflight.has(channel)) return inflight.get(channel)!;
    const promise = readChannel(channel).finally(()=>inflight.delete(channel));
    inflight.set(channel,promise);
    return promise;
  }));
}
