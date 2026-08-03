import { AppShell } from "@/components/app-shell";
import { DeviceManager } from "@/components/device-manager";
import { clockRuleKey, parseClockRule } from "@/lib/clock-rules";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DeviceSettingsPage() {
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
