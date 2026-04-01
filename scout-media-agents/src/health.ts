import "dotenv/config";

async function main(): Promise<void> {
  const base = process.env.SCOUT_MEDIA_API_BASE || "http://127.0.0.1:8080";
  const apiKey = process.env.SCOUT_MEDIA_API_KEY || "";

  const headers: Record<string, string> = {};
  if (apiKey) headers["x-api-key"] = apiKey;

  const health = await fetch(`${base}/api/health`, { headers });
  const text = await health.text();

  console.log(JSON.stringify({ status: health.status, body: text }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
