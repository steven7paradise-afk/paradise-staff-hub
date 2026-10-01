import AppointmentsPage from "@/components/appointments-page";

export const dynamic = "force-dynamic";

export default function Page(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return <AppointmentsPage {...props} />;
}
