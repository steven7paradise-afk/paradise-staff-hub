import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageSocialGoals, getSocialAudience, SOCIAL_CHANNELS, validSocialGoal } from "@/lib/social-audience";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function currentUser() {
  const session = await auth();
  return session?.user?.id ? prisma.user.findUnique({where:{id:session.user.id},select:{id:true,role:true,mansione:true}}) : null;
}
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({error:"Non autorizzato"},{status:401});
  if (!canManageSocialGoals(user.role) && user.role !== "RESPONSABILE" && !user.mansione?.toLowerCase().includes("social")) return NextResponse.json({error:"Accesso negato"},{status:403});
  try { return NextResponse.json({channels:await getSocialAudience(),canManage:canManageSocialGoals(user.role)},{headers:{"Cache-Control":"private, no-store"}}); }
  catch {return NextResponse.json({error:"Statistiche temporaneamente non disponibili."},{status:503});}
}
export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({error:"Non autorizzato"},{status:401});
  if (!canManageSocialGoals(user.role)) return NextResponse.json({error:"Solo l’admin può modificare gli obiettivi."},{status:403});
  try {
    const {channel,target} = await request.json();
    if (!SOCIAL_CHANNELS.includes(channel) || !validSocialGoal(target)) return NextResponse.json({error:"Inserisci un obiettivo intero maggiore di zero."},{status:400});
    const key = `social.goal.${channel}`;
    const value = {target,updatedBy:user.id,updatedAt:new Date().toISOString()};
    await prisma.setting.upsert({where:{key},create:{key,value},update:{value}});
    return NextResponse.json({channel,target});
  } catch {return NextResponse.json({error:"Obiettivo non salvato. Riprova."},{status:500});}
}
