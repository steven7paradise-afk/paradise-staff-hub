export function GET() {
  return Response.json({
  "id": "/my-staff",
  "name": "MyParadise",
  "short_name": "MyParadise",
  "description": "Chat e chiamate del team Paradise Beauty.",
  "lang": "it",
  "start_url": "/my-staff",
  "scope": "/my-staff",
  "display": "standalone",
  "background_color": "#fff7fa",
  "theme_color": "#f7e9ef",
  "icons": [
    { "src": "/my-staff/icon.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
  ]
}, { headers: { "Content-Type": "application/manifest+json" } });
}
