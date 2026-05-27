import { AppShell } from "@/components/app-shell";
import { DeviceManager } from "@/components/device-manager";
import { clockRuleKey, parseClockRule } from "@/lib/clock-rules";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DeviceSettingsPage() {
  const [devices, locations, settings] = await Promise.all([
    prisma.device.findMany({
      where: { archived_at: null, NOT: { device_id: { startsWith: "ADMIN-MANUAL-" } } },
      include: { location: true },
      orderBy: { created_at: "desc" },
    }),
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.setting.findMany({ where: { key: { startsWith: "clock_rule:" } } }),
  ]);
  return (
    <AppShell title="Dispositivi" subtitle="Crea il link sicuro per un tablet, registra IP e controlla le autorizzazioni per salone.">
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
      />
    </AppShell>
  );
}
