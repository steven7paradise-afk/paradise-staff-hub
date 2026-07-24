export function resolveDrivePhotoUrl(photoUrl: string | null | undefined) {
  if (!photoUrl) return "";

  const localDriveImageMatch = photoUrl.match(/\/api\/drive-image\?id=([^&]+)/);
  const fileMatch = photoUrl.match(/\/file\/d\/([^/]+)/);
  const idMatch = photoUrl.match(/[?&]id=([^&]+)/);
  const fileId = localDriveImageMatch?.[1] || fileMatch?.[1] || idMatch?.[1];

  if (fileId && (photoUrl.includes("drive.google.com") || photoUrl.startsWith("/api/drive-image"))) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(decodeURIComponent(fileId))}&sz=w1200`;
  }

  return photoUrl;
}
