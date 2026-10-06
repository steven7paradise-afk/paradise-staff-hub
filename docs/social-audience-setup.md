# Social followers via Apify

Chosen provider: Apify Free. No Meta/TikTok API access is needed. Sign in to Apify, confirm the account is on Free without a payment card, then configure APIFY_API_TOKEN on the server (never NEXT_PUBLIC). Do not paste tokens in chat or commit them. Restart the server after configuration.

Actors: apify/instagram-profile-scraper, apify/facebook-pages-scraper, clockworks/tiktok-profile-scraper. Handle: paradisebeauty.it. Each requests one profile; TikTok requests only one post for its author statistics. Downloads and follower lists are disabled.

Each social has at most one run started per Europe/Rome calendar day, enforced by a unique database settings key. The maximum actor charge is 0.03 USD/run and timeout is 120 seconds. The application must remain on the Free plan to prevent paid overages; platform costs and actual actor availability must be checked in the first live test. If the per-run limit is insufficient, do not automatically increase it.

The long-running Node server checks every five minutes. Opening the page also catches up and polls pending runs every minute. No paid retry is started on the same day after an ambiguous timeout. Restarted/multiple server instances reuse the durable run claim. Last successful counts remain visible with the original timestamp on errors. Provider outputs must match the configured profile and have a numeric follower count; missing values never become zero. Facebook handle resolution and TikTok output shape still require a live verification.

Targets use social.goal.PLATFORM settings and can be changed only by ADMIN, SUPER_ADMIN, ZERO; API checks this server-side. Staff see targets and progress. Targets are absolute follower totals, not a daily increment.

Local token configured and live test completed on 2026-10-06: Instagram 107329 followers, TikTok 66000. Facebook returned not_available for https://www.facebook.com/paradisebeauty.it/; confirm the correct public Page URL before enabling its results. Total reported charge for the three runs: $0.0176 of free credit. No paid subscription created. Audience cards are displayed above the social calendar. Production still requires APIFY_API_TOKEN in server environment and deployment/restart. Background polling requires a persistent Node process; serverless deployments require an external scheduler.

References:
https://apify.com/pricing
https://apify.com/apify/instagram-profile-scraper/input-schema
https://apify.com/apify/facebook-pages-scraper/input-schema
https://apify.com/clockworks/tiktok-profile-scraper/input-schema
https://docs.apify.com/api/v2/actors-runs-post
