import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizeShiftResponsibleQuestions } from "@/lib/shift-responsible-questions";
import { shiftQuestionnaireTemplate, type ShiftQuestionnaireScope } from "@/lib/shift-responsible-question-templates";

const adminRoles = new Set(["ZERO", "SUPER_ADMIN", "ADMIN"]);
const scopes = new Set<ShiftQuestionnaireScope>(["OPENING", "SERVICE", "CLOSING", "COMPLETE"]);

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  return (payload?.output ?? [])
    .flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .map((item: any) => typeof item?.text === "string" ? item.text : "")
    .join("")
    .trim();
}

function parseQuestions(text: string) {
  const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const parsed = JSON.parse(clean);
    const source = Array.isArray(parsed) ? parsed : parsed?.questions;
    return normalizeShiftResponsibleQuestions(source);
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !adminRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null) as { scope?: unknown; instructions?: unknown } | null;
  const requestedScope = typeof payload?.scope === "string" ? payload.scope : "COMPLETE";
  const scope: ShiftQuestionnaireScope = scopes.has(requestedScope as ShiftQuestionnaireScope)
    ? requestedScope as ShiftQuestionnaireScope
    : "COMPLETE";
  const instructions = typeof payload?.instructions === "string" ? payload.instructions.trim().slice(0, 800) : "";
  const fallback = shiftQuestionnaireTemplate(scope);
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) return NextResponse.json({ questions: fallback, mode: "template" });

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_NOTE_MODEL || "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: "Sei un esperto di procedure operative per saloni beauty. Genera un questionario concreto in italiano, ordinato come il turno e senza domande duplicate. Usa YES_NO per controlli oggettivi e TEXT per note, nomi, quantità o consegne. Ogni anomalia deve avere followUpYes o followUpNo scritto in modo coerente. Restituisci esclusivamente un array JSON con oggetti: title, description, answerType, followUpYes, followUpNo. answerType può essere solo YES_NO o TEXT. Non includere id. Massimo 20 domande.",
          },
          {
            role: "user",
            content: `Tipo di controllo: ${scope}. ${instructions ? `Indicazioni aggiuntive: ${instructions}` : "Crea una copertura completa e pratica per un responsabile di turno."}`,
          },
        ],
        max_output_tokens: 3000,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(35_000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error("Generazione non disponibile");
    const generated = parseQuestions(extractOutputText(data));
    if (!generated.length) throw new Error("Risposta non valida");
    return NextResponse.json({
      questions: generated.map((question, index) => ({ ...question, id: `generated-ai-${Date.now()}-${index}` })),
      mode: "ai",
    });
  } catch (error) {
    console.error("Questionnaire generation failed:", error);
    return NextResponse.json({ questions: fallback, mode: "template" });
  }
}
