import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { authorizedTablet, requestIp, tabletCookieName, tabletDeviceCookieName } from "@/lib/tablet-auth";

export const dynamic = "force-dynamic";

const SETTING_KEY = "client_control_note_suggestions";

type LearnedNoteSuggestion = { text: string; count: number; lastUsed: number };

function normalizeNoteSuggestion(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[.!?;:,]+$/g, "")
    .trim()
    .slice(0, 90);
}

function normalizeSuggestions(value: unknown): LearnedNoteSuggestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      text: normalizeNoteSuggestion(item?.text),
      count: Math.max(1, Number(item?.count ?? 1)),
      lastUsed: Number(item?.lastUsed ?? 0),
    }))
    .filter((item) => item.text.length >= 8)
    .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
    .slice(0, 50);
}

function extractNoteSuggestions(note: string) {
  return note
    .split(/[.\n;]+/)
    .map(normalizeNoteSuggestion)
    .filter((item) => item.length >= 8 && item.length <= 90)
    .filter((item) => item.split(/\s+/).length >= 2)
    .slice(0, 10);
}

async function requireTablet(request: NextRequest) {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const requestedDevice = cookieStore.get(tabletDeviceCookieName)?.value ?? request.headers.get("x-device-id") ?? "";
  return requestedDevice
    ? authorizedTablet(requestedDevice, cookieStore.get(tabletCookieName)?.value, requestIp(headerStore)).catch(() => null)
    : null;
}

export async function GET(request: NextRequest) {
  const tabletDevice = await requireTablet(request);
  if (!tabletDevice) {
    return NextResponse.json({ error: "Tablet non autorizzato." }, { status: 401 });
  }

  const setting = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  return NextResponse.json({ suggestions: normalizeSuggestions(setting?.value) });
}

export async function POST(request: NextRequest) {
  const tabletDevice = await requireTablet(request);
  if (!tabletDevice) {
    return NextResponse.json({ error: "Tablet non autorizzato." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const note = String(body?.note ?? "").trim().slice(0, 2000);
  const phrases = extractNoteSuggestions(note);
  if (phrases.length === 0) {
    const setting = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
    return NextResponse.json({ suggestions: normalizeSuggestions(setting?.value) });
  }

  const nowMs = Date.now();
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.setting.findUnique({ where: { key: SETTING_KEY } });
    const byText = new Map<string, LearnedNoteSuggestion>();

    normalizeSuggestions(current?.value).forEach((item) => {
      byText.set(item.text.toLowerCase(), item);
    });

    phrases.forEach((phrase) => {
      const key = phrase.toLowerCase();
      const existing = byText.get(key);
      byText.set(key, {
        text: existing?.text ?? phrase,
        count: (existing?.count ?? 0) + 1,
        lastUsed: nowMs,
      });
    });

    const suggestions = Array.from(byText.values())
      .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
      .slice(0, 50);

    await tx.setting.upsert({
      where: { key: SETTING_KEY },
      update: { value: suggestions },
      create: { key: SETTING_KEY, value: suggestions },
    });

    return suggestions;
  });

  return NextResponse.json({ suggestions: updated });
}
