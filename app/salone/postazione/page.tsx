import AppointmentsPage from "@/app/appointments/page";

export const dynamic = "force-dynamic";

export default async function SalonStationPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return AppointmentsPage({
    searchParams,
    navigationBasePath: "/salone/postazione",
    pageTitle: "La mia postazione",
    pageSubtitle: "La cliente in lavorazione e tutte le informazioni del servizio",
    salonWorkflowMode: "station",
  });
}
