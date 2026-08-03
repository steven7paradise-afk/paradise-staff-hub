import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import AppointmentsPage from "../page";
import { normalizeAppointmentSalonSlug } from "@/lib/appointment-salon-url";
import { appointmentsPcCookieName, checkPCAuthorization } from "@/lib/appointments-pc-auth";
import { AppointmentsKioskEntry } from "@/components/appointments-kiosk-entry";

export const dynamic = "force-dynamic";

export default async function SalonAppointmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ salone?: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await params;
  const salone = normalizeAppointmentSalonSlug(resolvedParams.salone);
  if (!salone) notFound();

  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();
  const pcToken = cookieStore.get(appointmentsPcCookieName)?.value;
  const pcAuth = await checkPCAuthorization(pcToken);

  if (!pcAuth) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#FCE6EF] p-6 text-center text-neutral-900">
        <section className="w-full max-w-md rounded-[28px] border border-[#F4C9D9] bg-white p-8 shadow-2xl">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-[#FADBEA] font-serif text-lg font-black text-[#F12D83]">
            P
          </div>
          <h1 className="mt-6 font-serif text-2xl font-semibold text-neutral-950">
            PC non autorizzato
          </h1>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-neutral-500">
            Questo computer deve essere prima attivato con un link monouso del salone.
          </p>
        </section>
      </main>
    );
  }

  if (resolvedSearchParams.unlocked !== "1") {
    return <AppointmentsKioskEntry salone={salone} />;
  }

  return AppointmentsPage({
    searchParams: Promise.resolve({
      ...resolvedSearchParams,
      salone,
    }),
    forcePcSalon: salone,
  });
}
