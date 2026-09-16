export function loadStaffReportPhoto(row: { name: string; photoUrl?: string | null }): Promise<string | null> {
  if (!row.photoUrl) return Promise.resolve(null);
  return new Promise(resolve => {
    const image = new Image(); image.crossOrigin = "anonymous";
    const timer = window.setTimeout(() => { image.src = ""; resolve(null); }, 7000);
    image.onerror = () => { window.clearTimeout(timer); resolve(null); };
    image.onload = () => {
      window.clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas"); canvas.width = canvas.height = 180;
        const context = canvas.getContext("2d"); if (!context) return resolve(null);
        context.fillStyle = "#fff"; context.fillRect(0, 0, 180, 180);
        const side = Math.min(image.naturalWidth, image.naturalHeight);
        context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 180, 180);
        resolve(canvas.toDataURL("image/jpeg", .9));
      } catch { resolve(null); }
    };
    const driveId = row.photoUrl!.match(/drive\.google\.com\/file\/d\/([^/]+)/)?.[1];
    image.src = driveId ? `/api/drive-image?id=${encodeURIComponent(driveId)}` : row.photoUrl!;
  });
}
