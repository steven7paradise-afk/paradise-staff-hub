import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import AppointmentsPage from "../page";
import { normalizeAppointmentSalonSlug } from "@/lib/appointment-salon-url";
import { appointmentsPcCookieName, appointmentsPcWorkerCookieName, checkPCAuthorization } from "@/lib/appointments-pc-auth";
import { AppointmentsKioskEntry } from "@/components/appointments-kiosk-entry";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAlwaysActiveAppointmentStaff } from "@/lib/appointment-staff-access";

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
  const session = await auth();
  const remoteTarget = typeof resolvedSearchParams.remoteTarget === "string" ? resolvedSearchParams.remoteTarget : "";
  const isAdministratorSession = Boolean(
    session?.user?.id && ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(session.user.role),
  );
  const isAdminRemote = Boolean(remoteTarget && session?.user?.id && ["ZERO", "SUPER_ADMIN", "ADMIN"].includes(session.user.role));
  const selectedWorker = cookieStore.get(appointmentsPcWorkerCookieName)?.value;
  const selectedWorkerIdentity = selectedWorker ? decodeURIComponent(selectedWorker) : "";
  const selectedWorkerCandidate = pcAuth && selectedWorkerIdentity
    ? await prisma.user.findFirst({
        where: {
          active: true,
          OR: [{ id: selectedWorkerIdentity }, { name: selectedWorkerIdentity }],
        },
        select: { id: true, name: true, sede_id: true },
      }).catch(() => null)
    : null;
  const selectedWorkerRecord = selectedWorkerCandidate && pcAuth && (
    selectedWorkerCandidate.sede_id === pcAuth.locationId ||
    isAlwaysActiveAppointmentStaff(selectedWorkerCandidate.name, selectedWorkerCandidate.id)
  ) ? selectedWorkerCandidate : null;
  const forceProfileChoice = resolvedSearchParams.choose === "1";

  if (isAdministratorSession && !remoteTarget) {
    return await AppointmentsPage({
      searchParams: Promise.resolve({ ...resolvedSearchParams, salone }),
    });
  }

  if (!pcAuth && !isAdminRemote) {
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

  if (isAdminRemote && forceProfileChoice) {
    return <AppointmentsKioskEntry salone={salone} pcName="Controllo remoto Admin" remoteTarget={remoteTarget} />;
  }

  if (!selectedWorker || !selectedWorkerRecord || forceProfileChoice) {
    return <AppointmentsKioskEntry salone={salone} pcName={pcAuth?.name} />;
  }

  return await AppointmentsPage({
    searchParams: Promise.resolve({
      ...resolvedSearchParams,
      salone,
      unlocked: "1",
      worker: selectedWorkerRecord.name,
    }),
    forcePcSalon: salone,
  });
}
