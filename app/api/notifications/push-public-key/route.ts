import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPublicVapidKey } from "@/lib/push-sender";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const publicKey = await getPublicVapidKey();
    return NextResponse.json({ publicKey });
  } catch (error) {
    console.error("Failed to get public VAPID key", error);
    return NextResponse.json({ error: "Failed to get VAPID key" }, { status: 500 });
  }
}
