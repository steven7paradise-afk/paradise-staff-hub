import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mergeResultBonusSettings, ResultBonusSettingsConflict } from "@/lib/result-bonus-settings-merge";
import {
  buildResultBonusData,
  isBuenosAiresActor,
  loadResultBonusState,
  mayConfigureResultBonus,
  mayManageResultBonus,
  saveResultBonusState,
} from "@/lib/result-bonus-data";
import {
  RESULT_BONUS_LEVELS,
  resultBonusEventEffect,
  validResultBonusMonth,
  type ResultBonusEventType,
  type ResultBonusLevel,
} from "@/lib/result-bonus";

export const dynamic = "force-dynamic";

async function currentActor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true, active: true, sede_id: true, location: { select: { name: true } } },
  });
}

function monthFrom(request: NextRequest, body?: Record<string, unknown>) {
  const fallback = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" }).format(new Date());
  return validResultBonusMonth(String(body?.month ?? request.nextUrl.searchParams.get("month") ?? fallback));
}

export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor?.active) return NextResponse.json({ error: "Accesso richiesto." }, { status: 401 });
  if (!mayConfigureResultBonus(actor)) {
    return NextResponse.json({ error: "Area riservata agli amministratori." }, { status: 403 });
  }
  try {
    return NextResponse.json(await buildResultBonusData(actor, monthFrom(request)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossibile caricare il premio." }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor?.active) return NextResponse.json({ error: "Accesso richiesto." }, { status: 401 });
  if (!mayConfigureResultBonus(actor)) {
    return NextResponse.json({ error: "Area riservata agli amministratori." }, { status: 403 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const month = monthFrom(request, body);
    const action = String(body.action ?? "");
    const saved = await prisma.$transaction(async (tx) => {
      const state = await loadResultBonusState(month, tx);
      const revision = Number(body.revision);
      if (action !== "rules" && (!Number.isInteger(revision) || revision !== state.revision)) {
        throw new Error("I dati sono stati aggiornati da un’altra persona. Ricarica e riprova.");
      }

      if (action === "rules") {
        if (!mayConfigureResultBonus(actor)) throw new Error("Solo la direzione può modificare il valore delle dinamiche.");
        const merged = mergeResultBonusSettings(state, body);
        state.rules = merged.rules;
        state.dailyValues = merged.dailyValues;
        state.ruleHistory = [...(state.ruleHistory ?? []), { at: new Date().toISOString(), actorId: actor.id, actorName: actor.name, rules: state.rules, ...(state.dailyValues ? { dailyValues: state.dailyValues } : {}) }];
        state.acknowledgements = {};
      } else if (action === "personal-bonus") {
        if (!mayConfigureResultBonus(actor)) throw new Error("Solo la direzione può assegnare premi individuali.");
        const userId = String(body.userId ?? "");
        const person = await tx.user.findUnique({ where: { id: userId }, select: { active: true, role: true, location: { select: { name: true } } } });
        if (!person?.active || !["RESPONSABILE", "DIPENDENTE"].includes(person.role) || !isBuenosAiresActor(person.location?.name) || !state.configs[userId]) throw new Error("Seleziona una persona attiva di Buenos Aires con livello premio assegnato.");
        const amount = body.amount;
        if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > 10000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) throw new Error("Inserisci un premio maggiore di zero, massimo 10.000 €, con due decimali.");
        const date = String(body.date ?? "");
        if (!date.startsWith(`${month}-`) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error("Scegli una data valida nel mese selezionato.");
        const evidence = String(body.evidence ?? "").trim();
        if (!evidence || evidence.length > 1000) throw new Error("Inserisci una motivazione, massimo 1.000 caratteri.");
        const id = String(body.requestId ?? "");
        if (!/^[\da-f-]{36}$/i.test(id)) throw new Error("Richiesta non valida. Ricarica la pagina.");
        if (state.events.some((event) => event.id === id)) throw new Error("Questo premio risulta già registrato. Ricarica la pagina.");
        state.events.push({ id, userId, date, type: "PERSONAL_BONUS", amount, evidence, actorId: actor.id, actorName: actor.name, createdAt: new Date().toISOString() });
        delete state.acknowledgements[userId];
      } else if (action === "configure") {
        if (!mayConfigureResultBonus(actor)) throw new Error("Solo la direzione può assegnare il livello.");
        const userId = String(body.userId ?? "");
        const level = String(body.level ?? "") as ResultBonusLevel;
        const person = await tx.user.findUnique({
          where: { id: userId },
          select: { active: true, role: true, location: { select: { name: true } } },
        });
        if (!person?.active || !["RESPONSABILE", "DIPENDENTE"].includes(person.role) || !isBuenosAiresActor(person.location?.name)) {
          throw new Error("Seleziona una persona attiva del salone Buenos Aires.");
        }
        if (!Object.hasOwn(RESULT_BONUS_LEVELS, level)) throw new Error("Seleziona un livello valido.");
        state.configs[userId] = { userId, level };
      } else if (action === "event") {
        if (!mayManageResultBonus(actor)) throw new Error("Solo gli amministratori possono registrare eventi premio.");
        const userId = String(body.userId ?? "");
        const config = state.configs[userId];
        if (!config) throw new Error("Persona non configurata.");
        const date = String(body.date ?? "");
        if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || !date.startsWith(month)) throw new Error("La data deve appartenere al mese selezionato.");
        const type = String(body.type ?? "") as ResultBonusEventType;
        const supported = ["APPEARANCE", "REWORK_OPERATOR", "REWORK_CLIENT", "REWORK_PRODUCT", "NEGATIVE_REVIEW", "POSITIVE_REVIEW", "URGENT_AVAILABILITY", "TRAINING"];
        if (!supported.includes(type)) throw new Error("Tipo evento non valido.");
        if (type === "TRAINING" && config.level !== "JUNIOR") throw new Error("Il bonus formazione è riservato al livello Junior.");
        const evidence = String(body.evidence ?? "").trim().slice(0, 1000);
        if (!evidence) throw new Error("Inserisci una nota o un riferimento verificabile.");
        resultBonusEventEffect(type, config.level);
        state.events.push({ id: crypto.randomUUID(), userId, date, type, evidence, actorId: actor.id, actorName: actor.name, createdAt: new Date().toISOString() });
      } else if (action === "dispute") {
        const userId = String(body.userId ?? "");
        if (actor.id !== userId && !mayConfigureResultBonus(actor)) throw new Error("Puoi contestare soltanto una tua rilevazione.");
        if (!state.configs[userId]) throw new Error("Persona non configurata.");
        const targetDate = String(body.targetDate ?? "");
        const targetTime = new Date(`${targetDate}T12:00:00+02:00`).getTime();
        if (!Number.isFinite(targetTime) || Date.now() - targetTime > 3 * 86_400_000) throw new Error("Il termine di 3 giorni per la contestazione è scaduto.");
        const reason = String(body.reason ?? "").trim().slice(0, 1000);
        if (!reason) throw new Error("Spiega il motivo della contestazione.");
        const targetId = String(body.targetId ?? "");
        if (state.disputes.some((item) => item.userId === userId && item.targetId === targetId && item.status === "OPEN")) throw new Error("Contestazione già inviata.");
        state.disputes.push({ id: crypto.randomUUID(), userId, targetId, targetDate, reason, status: "OPEN", createdAt: new Date().toISOString() });
      } else if (action === "resolve-dispute") {
        if (!mayConfigureResultBonus(actor)) throw new Error("Solo la direzione può chiudere una contestazione.");
        const dispute = state.disputes.find((item) => item.id === String(body.disputeId ?? ""));
        const status = String(body.status ?? "");
        if (!dispute || !["ACCEPTED", "REJECTED"].includes(status)) throw new Error("Contestazione o esito non valido.");
        dispute.status = status as "ACCEPTED" | "REJECTED";
        dispute.resolvedAt = new Date().toISOString();
        dispute.resolvedBy = actor.name;
      } else if (action === "acknowledge") {
        const userId = String(body.userId ?? "");
        if (actor.id !== userId) throw new Error("La presa visione deve essere personale.");
        if (!state.configs[userId]) throw new Error("Persona non configurata.");
        state.acknowledgements[userId] = { userId, at: new Date().toISOString(), actorName: actor.name };
      } else {
        throw new Error("Operazione non riconosciuta.");
      }

      state.revision += 1;
      await saveResultBonusState(month, state, tx);
      return { revision: state.revision, ...(action === "rules" ? { rules: state.rules, dailyValues: state.dailyValues } : {}) };
    }, { timeout: 15_000, isolationLevel: "Serializable" });

    return NextResponse.json({ ok: true, ...saved });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Salvataggio non riuscito." }, { status: error instanceof ResultBonusSettingsConflict ? 409 : 400 });
  }
}
