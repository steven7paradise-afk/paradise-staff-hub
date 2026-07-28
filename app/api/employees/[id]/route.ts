import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { isPinAlreadyAssigned, pinLookup } from "@/lib/pin";
import { prisma } from "@/lib/prisma";

const managementRoles = new Set(["SUPER_ADMIN", "ADMIN"]);

function apiError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function readableEmployeeError(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    const target = Array.isArray((error as { meta?: { target?: unknown } }).meta?.target)
      ? ((error as { meta?: { target?: string[] } }).meta?.target ?? []).join(", ")
      : "";

    if (code === "P2002") {
      if (target.includes("email")) return "Questa email e gia assegnata a un altro collaboratore.";
      if (target.includes("pin_lookup")) return "Questo PIN e gia assegnato a un altro collaboratore.";
      return "Esiste gia un collaboratore con questi dati.";
    }
  }

  return error instanceof Error ? error.message : "Errore durante il salvataggio del collaboratore.";
}

function todayUtcStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id || !managementRoles.has(session.user.role)) {
      return apiError("Non autorizzato", 403);
    }

    const { id } = await context.params;
    const data = await request.json().catch(() => null);
    if (!data || typeof data !== "object") {
      return apiError("Dati collaboratore non validi.", 400);
    }

    const pin = data.pin ? String(data.pin) : "";
    const password = data.password ? String(data.password) : "";
    const role = String(data.role ?? "DIPENDENTE") as UserRole;
    const birthDate = data.birthDate ? new Date(String(data.birthDate)) : null;
    const contractStart = data.contractStart ? new Date(String(data.contractStart)) : null;
    const contractEnd = data.contractEnd ? new Date(String(data.contractEnd)) : null;

    if (pin && !/^\d{4,6}$/.test(pin)) {
      return apiError("Il PIN deve avere da 4 a 6 numeri.", 400);
    }
    if (password && password.length < 8) {
      return apiError("La password deve avere almeno 8 caratteri.", 400);
    }
    if (!Object.values(UserRole).includes(role)) {
      return apiError("Ruolo non valido.", 400);
    }
    if (pin && await isPinAlreadyAssigned(pin, id)) {
      return apiError("Questo PIN e gia assegnato a un altro lavoratore. Inserisci un codice unico.", 409);
    }

    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) {
      return apiError("Utente non trovato.", 404);
    }

    const nextSedeId = data.sedeId !== undefined ? (data.sedeId ? String(data.sedeId) : null) : undefined;
    const baseUpdate = {
      name: String(data.name ?? current.name).trim(),
      email: String(data.email ?? current.email).trim().toLowerCase(),
      role,
      sede_id: nextSedeId,
      birth_date: birthDate,
      fiscal_code: data.fiscalCode !== undefined ? (data.fiscalCode ? String(data.fiscalCode).trim().toUpperCase() : null) : undefined,
      contract_start: contractStart,
      contract_end: contractEnd,
      photo_url: data.photoUrl !== undefined ? (data.photoUrl ? String(data.photoUrl).trim() : null) : undefined,
      whatsapp_phone: data.whatsappPhone !== undefined ? (data.whatsappPhone ? String(data.whatsappPhone).trim() : null) : undefined,
      mansione: data.mansione !== undefined ? (data.mansione ? String(data.mansione).trim() : null) : undefined,
      iban: data.iban !== undefined ? (data.iban ? String(data.iban).trim().toUpperCase() : null) : undefined,
      active: data.active !== undefined ? Boolean(data.active) : undefined,
      employee_status: data.employeeStatus !== undefined ? String(data.employeeStatus) : undefined,
      manager_id: data.managerId !== undefined ? (data.managerId ? String(data.managerId) : null) : undefined,
      access_list: data.accessList !== undefined ? data.accessList : undefined,
      hr_notes: data.hrNotes !== undefined ? (data.hrNotes ? String(data.hrNotes) : null) : undefined,
      workforce_data: data.workforceData !== undefined
        ? (data.workforceData && typeof data.workforceData === "object" && !Array.isArray(data.workforceData) ? data.workforceData : {})
        : undefined,
      google_calendar_id: data.googleCalendarId !== undefined ? (data.googleCalendarId ? String(data.googleCalendarId).trim() : null) : undefined,
      google_calendar_sync: data.googleCalendarSync !== undefined ? Boolean(data.googleCalendarSync) : undefined,
      contract_history: data.contractHistory !== undefined ? data.contractHistory : undefined,
      last_edited_by_id: session.user.id,
      last_edited_at: new Date(),
      ...(pin ? { pin_hash: await bcrypt.hash(pin, 12), pin_lookup: pinLookup(pin) } : {}),
      ...(password ? { password_hash: await bcrypt.hash(password, 12) } : {}),
    };

    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: baseUpdate,
        include: {
          last_edited_by: {
            select: { id: true, name: true }
          }
        }
      });

      if (nextSedeId && nextSedeId !== current.sede_id) {
        const futureEntries = await tx.scheduleEntry.findMany({
          where: {
            user_id: id,
            date: { gte: todayUtcStart() },
          },
          include: { category: true },
        });

        for (const entry of futureEntries) {
          const category = await tx.scheduleCategory.upsert({
            where: {
              code_location_id: {
                code: entry.category.code,
                location_id: nextSedeId,
              },
            },
            create: {
              name: entry.category.name,
              code: entry.category.code,
              location_id: nextSedeId,
              color: entry.category.color,
              text_color: entry.category.text_color,
              start_time: entry.category.start_time,
              end_time: entry.category.end_time,
              editable_time: entry.category.editable_time,
              paid_hours: entry.category.paid_hours,
              active: entry.category.active,
            },
            update: {},
          });

          await tx.scheduleEntry.update({
            where: { id: entry.id },
            data: {
              location_id: nextSedeId,
              category_id: category.id,
            },
          });
        }

        await tx.scheduleWorkerOverride.deleteMany({ where: { user_id: id } });
      }

      return updatedUser;
    });

    return NextResponse.json({ ...user, password_hash: undefined, pin_hash: undefined, pinConfigured: Boolean(user.pin_hash) });
  } catch (error) {
    console.error("Employee update error:", error);
    return apiError(readableEmployeeError(error), 500);
  }
}
