import { loadClientControlAnalytics } from "@/lib/client-control-analytics-data";
import { ClientControlAnalytics } from "./analytics-client";

export async function AnalyticsView({ requestedMonth }: { requestedMonth?: string }) {
  const data = await loadClientControlAnalytics(requestedMonth);
  return <ClientControlAnalytics key={data.month} {...data} />;
}
