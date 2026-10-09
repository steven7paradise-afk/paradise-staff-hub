// Coolify Scheduled Task: run every minute inside the Staff Hub container.
const token = process.env.PLANNING_DELIVERY_TOKEN;
if (!token || token.length < 32) {
  console.error("Planning recovery token is not configured.");
  process.exit(1);
}
try {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port");
  const response = await fetch(`http://127.0.0.1:${port}/api/integrations/planning/retry`, {
    method: "POST",
    redirect: "error",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(25000),
  });
  const result = await response.json();
  if (!response.ok || !["idle", "delivered"].includes(result.status)) {
    console.error("Planning recovery incomplete; the next scheduled run will retry.");
    process.exitCode = 1;
  } else {
    console.log(`Planning recovery: ${result.status}`);
  }
} catch {
  console.error("Planning recovery unavailable; the next scheduled run will retry.");
  process.exitCode = 1;
}
