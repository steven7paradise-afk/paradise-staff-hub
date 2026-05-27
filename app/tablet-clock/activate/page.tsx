import { TabletActivation } from "@/components/tablet-activation";

export default async function TabletActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return <TabletActivation token={token} />;
}
