import { AppShell } from "@/components/app-shell";
import { DeviceManager } from "@/components/device-manager";
import { clockRuleKey, parseClockRule } from "@/lib/clock-rules";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Nfc } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DeviceSettingsPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ZERO") redirect("/dashboard");

  const [devices, locations, settings, pcsSetting] = await Promise.all([
    prisma.device.findMany({
      where: { archived_at: null, NOT: { device_id: { startsWith: "ADMIN-MANUAL-" } } },
      include: { location: true },
      orderBy: { created_at: "desc" },
    }),
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.setting.findMany({ where: { key: { startsWith: "clock_rule:" } } }),
    prisma.setting.findUnique({ where: { key: "appointments_authorized_pcs" } }),
  ]);

  const rawPcsList = Array.isArray(pcsSetting?.value) ? (pcsSetting.value as any[]) : [];
  
  // Format authorized PCs for manager view
  const initialPcs = rawPcsList.map((pc) => {
    const loc = locations.find((l) => l.id === pc.locationId);
    return {
      code: pc.code,
      name: pc.name,
      location: loc ? loc.name : "Salone",
      locationId: pc.locationId,
      createdAt: pc.createdAt,
      activatedAt: pc.activatedAt,
      archivedAt: pc.archivedAt,
      registeredIp: pc.registeredIp,
    };
  });

  return (
    <AppShell title="Dispositivi" subtitle="Crea e gestisci i link sicuri per i tablet timbratrici e i PC cassa / reception.">
      <Link href="/settings/nfc" className="mb-5 flex items-center justify-between rounded-[24px] border border-pink-200 bg-gradient-to-r from-white to-pink-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div><p className="font-semibold">Badge NFC per la timbratrice</p><p className="mt-1 text-sm text-black/55">Apri questa funzione dal tablet autorizzato per preparare le tessere personali.</p></div>
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-black text-white"><Nfc className="size-6" /></div>
      </Link>
      <DeviceManager
        initialDevices={devices.map((device) => ({
          id: device.id,
          deviceId: device.device_id,
          name: device.device_name,
          location: device.location.name,
          status: device.status,
          lastUsed: device.last_used_at?.toISOString() ?? null,
          registeredIp: device.registered_ip,
          activatedAt: device.activated_at?.toISOString() ?? null,
        }))}
        locations={locations.map((location) => ({ id: location.id, name: location.name }))}
        initialRules={Object.fromEntries(locations.map((location) => [
          location.id,
          parseClockRule(settings.find((setting) => setting.key === clockRuleKey(location.id))?.value),
        ]))}
        initialPcs={initialPcs}
      />
    </AppShell>
  );
}
