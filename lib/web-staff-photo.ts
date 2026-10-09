// Only resolve stored Drive photo references, never arbitrary URLs supplied by a caller.
export function staffDrivePhotoId(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, "https://my.staff-paradise.tech");
    const local = ["my.staff-paradise.tech", "staff-paradise.tech", "www.staff-paradise.tech"].includes(url.hostname) && url.pathname === "/api/drive-image";
    if (!local && url.hostname !== "drive.google.com") return null;
    const id = url.searchParams.get("id") || url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1];
    return id && /^[a-zA-Z0-9_-]+$/.test(id) ? id : null;
  } catch { return null; }
}
export function staffPhotoSource(person: { id?: string; photo_url?: string | null }) {
  return person.id && staffDrivePhotoId(person.photo_url) ? `/api/mobile/web-calls/photo?userId=${encodeURIComponent(person.id)}` : person.photo_url || "";
}
