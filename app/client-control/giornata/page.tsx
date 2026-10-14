import { redirect } from "next/navigation";

// Existing bookmarks return to the appointments agenda.
export default function DailyClientControlPage() {
  redirect("/appointments");
}
