import AppointmentsPage from "@/app/appointments/page";

export const dynamic = "force-dynamic";

export default async function ReceptionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const hasRequestedRange = Boolean(
    resolvedSearchParams.scope ||
      resolvedSearchParams.from ||
      resolvedSearchParams.to,
  );

  return AppointmentsPage({
    searchParams: Promise.resolve({
      ...resolvedSearchParams,
      ...(hasRequestedRange ? {} : { scope: "all" }),
    }),
    navigationBasePath: "/salone/reception",
    pageTitle: "Reception",
    pageSubtitle: "Tutti gli appuntamenti, gli arrivi e i servizi del salone",
    salonWorkflowMode: "reception",
  });
}
