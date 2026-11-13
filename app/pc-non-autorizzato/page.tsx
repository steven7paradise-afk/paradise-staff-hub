import Link from "next/link";
import { cookies } from "next/headers";
import { appointmentSalonUrl } from "@/lib/appointment-salon-url";
import { appointmentSalonForPC, appointmentsPcCookieName, checkPCAuthorization } from "@/lib/appointments-pc-auth";

export const dynamic = "force-dynamic";

export default async function PcNonAutorizzatoPage() {
  const token = (await cookies()).get(appointmentsPcCookieName)?.value;
  const device = await checkPCAuthorization(token);
  const salon = device ? await appointmentSalonForPC(device.locationId) : null;
  const agendaUrl = `${appointmentSalonUrl(salon || "buenos-aires")}?choose=1`;
  return (
    <main className="grid min-h-screen place-items-center bg-[#FFFBF6] p-6 text-center text-neutral-900">
      <Link
        href={agendaUrl}
        className="inline-flex min-h-16 items-center justify-center rounded-2xl bg-neutral-950 px-8 text-sm font-semibold uppercase tracking-[0.24em] text-white shadow-[0_22px_45px_rgba(0,0,0,0.18)] transition hover:bg-neutral-800"
      >
        Torna a scegliere il tuo profilo
      </Link>
    </main>
  );
}
