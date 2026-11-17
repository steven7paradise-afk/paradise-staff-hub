export function clientControlUrl(month: string, options: { view?: "analytics"; id?: string } = {}) {
  const params = new URLSearchParams({ month });
  if (options.view) params.set("view", options.view);
  if (options.id) params.set("id", options.id);
  return `/client-control?${params.toString()}`;
}
