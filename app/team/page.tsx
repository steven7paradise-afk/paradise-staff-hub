import { redirect } from "next/navigation";

// Keep existing bookmarks useful after retiring the Team page.
export default function TeamPage() {
  redirect("/staff");
}
