export function resolveDrivePhotoUrl(photoUrl: string | null | undefined) {
  if (!photoUrl) return "";
  if (photoUrl.startsWith("/api/drive-image")) return photoUrl;

  const fileMatch = photoUrl.match(/\/file\/d\/([^/]+)/);
  const idMatch = photoUrl.match(/[?&]id=([^&]+)/);
  const fileId = fileMatch?.[1] || idMatch?.[1];

  if (fileId && photoUrl.includes("drive.google.com")) {
    return `/api/drive-image?id=${encodeURIComponent(fileId)}`;
  }

  return photoUrl;
}
