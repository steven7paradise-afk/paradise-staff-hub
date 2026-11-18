import { OrdersPage, type OrdersPageProps } from "@/components/orders-page";

export const dynamic = "force-dynamic";

export default function Page(props: OrdersPageProps) {
  return <OrdersPage {...props} workspace="conversions" />;
}
