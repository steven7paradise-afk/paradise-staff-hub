import AppointmentsPage from "@/app/appointments/page";

export const dynamic = "force-dynamic";

export default async function SalonQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return AppointmentsPage({
    searchParams,
    navigationBasePath: "/salone/incoda",
    pageTitle: "Sala d’attesa",
    pageSubtitle: "Clienti arrivati, tempo di attesa e prossima postazione",
    salonWorkflowMode: "queue",
  });
}
