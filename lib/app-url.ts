export function getPublicAppUrl(fallbackOrigin?: string | null) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    fallbackOrigin ||
    "https://www.staff-paradise.tech";

  return base.replace(/\/$/, "");
}

export function buildPublicAppUrl(path?: string | null, fallbackOrigin?: string | null) {
  const base = getPublicAppUrl(fallbackOrigin);
  if (!path) return base;
  if (path.startsWith("http")) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
