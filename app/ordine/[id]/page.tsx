import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderShortcutPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/orders?ordine=${encodeURIComponent(id)}`);
}
