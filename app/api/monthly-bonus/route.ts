import { NextResponse } from "next/server";

const disabledResponse = () => NextResponse.json(
  { error: "Il sistema punti non è più attivo." },
  { status: 410 }
);

export async function GET() {
  return disabledResponse();
}

export async function POST() {
  return disabledResponse();
}
