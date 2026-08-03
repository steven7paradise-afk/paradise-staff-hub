import { notFound } from "next/navigation";
import AppointmentsPage from "../page";
import { normalizeAppointmentSalonSlug } from "@/lib/appointment-salon-url";

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
  return AppointmentsPage({
    searchParams: Promise.resolve({
      ...resolvedSearchParams,
      salone,
    }),
    forcePcSalon: salone,
  });
}
