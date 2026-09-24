import { checkPCAuthorization } from "./appointments-pc-auth";
import { mobileUser } from "./mobile-auth";
import { prisma } from "./prisma";
import { getEffectivePermissionSet } from "./roles";
import { isWorkspaceAdmin, workspaceModules } from "./mobile-workspace-policy";

export async function mobileWorkspace(request: Request) {
  const deviceToken = request.headers.get("x-paradise-device");
  const device = deviceToken ? await checkPCAuthorization(deviceToken) : null;
  if (deviceToken && !device) return null;
  const auth = request.headers.has("authorization") ? await mobileUser(request) : null;
  if (request.headers.has("authorization") && (!auth || auth.user.must_change_password)) return null;
  if (!device && !auth) return null;

  // Elevated salon sessions must be used with the device that created them.
  const binding = auth?.session.device_name;
  if (binding?.startsWith("ios-salon:")) {
    if (!device || binding !== `ios-salon:${device.code}` || !isWorkspaceAdmin(auth!.user.role)) return null;
  } else if (device && auth) return null;

  const location = device ? await prisma.location.findUnique({ where: { id: device.locationId } }) : null;
  if (device && (!location || !location.active)) return null;
  const permissions = auth ? await getEffectivePermissionSet(prisma, auth.user) : undefined;
  const modules = workspaceModules(auth?.user ?? null, permissions);
  return { device, auth, location, modules };
}

export function workspaceResponse(context: NonNullable<Awaited<ReturnType<typeof mobileWorkspace>>>) {
  return {
    mode: context.device ? (context.auth ? "admin" : "salon") : "personal",
    name: context.auth?.user.name ?? context.device!.name,
    role: context.auth?.user.role ?? null,
    locationName: context.location?.name ?? context.auth?.user.location?.name ?? null,
    modules: context.modules,
  };
}
