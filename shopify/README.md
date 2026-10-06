# Gestione ordine Paradise

Admin order block for the existing staff hub paradise Shopify app. The backend is part of the parent Next.js app; this directory contains a separate Shopify CLI project and dependency lockfile.

## Behaviour

The block reads the current order GID from Shopify and queries `/api/shopify/order-block` with a Shopify ID token. The backend verifies HS256 signature, audience, destination, issuer, expiry, not-before and an explicit Shopify user allowlist. No browser cookie or Admin API access token is shipped to the extension.

It resolves only an exact order-number match in Modulo Ordine (`order_shopify_order`, legacy `field_1782221517924`, or numeric `order_title`). Missing/duplicate matches cannot be edited. Archived or non-operational states cannot be edited. The block records the verified Shopify user ID in the existing activity log, never impersonates a Staff Hub employee.

On save, the version check prevents overwriting a concurrent edit. A database row lock covers the Shopify request and update of the board; Shopify user errors abort the transaction. Only `custom.stato_ordine` and `custom.paradise_ultimo_aggiornamento` are written. Payment, fulfillment, customer notes and collaborator assignment are untouched. The latter metafield holds the operational note, actor and date as JSON.

Shopify and PostgreSQL do not support a shared distributed transaction. If Shopify succeeds but the final database commit fails, the UI reports failure and asks to refresh/retry; inspect both states before retrying after a connection loss. No success is reported before both writes complete.

## Required production configuration

Set these in the existing Staff Hub server secret configuration, never in browser code or this repository:

- `SHOPIFY_SHOP_DOMAIN`: existing `*.myshopify.com` shop.
- `SHOPIFY_ACCESS_TOKEN`: existing Admin API token.
- `SHOPIFY_API_KEY`: existing app client ID.
- `SHOPIFY_API_SECRET`: the existing app client secret (not the Admin API token).
- `SHOPIFY_ORDER_BLOCK_USER_IDS`: comma-separated verified Shopify staff user IDs allowed to edit operational orders. Empty configuration denies everyone.

The proxy exempts only this endpoint; the route independently authenticates all reads and writes. CORS is bearer-only, without cookies or credentials.

## Build and release

1. `pnpm install` within this directory.
2. `pnpm exec shopify app build --config production` builds the extension without releasing it.
3. Authenticate Shopify CLI and use `shopify app config link --client-id 836b41a3e723edac202df54710ac4250` to pull the existing live app configuration. The production configuration was pulled from the existing app on 2026-10-06. Keep its scopes and existing settings unchanged.
4. Preserve the existing live scopes, URLs and extensions. The extension UID has been registered by Shopify CLI. Do not replace or uninstall the app.
5. Deploy the Next.js backend and configure the server secrets before releasing the extension. Verify missing/expired tokens get 401 and an authorized user can load a known linked order.
6. Build and deploy using the linked live configuration (explicit `--config`), review the release diff, then add/pin **Gestione ordine Paradise** with **+ Blocco** on a Shopify order.
7. Verify on an authorized test order: all five states, note/date/audit, duplicate match refusal, concurrency conflict and Shopify errors. Test writes have not been made against customer orders during development.

The UI uses a fresh token per request and calls the production endpoint. For local preview, use a secure development tunnel and a corresponding endpoint build; do not send credentials to arbitrary tunnels.

## Current release preparation

Shopify version `gestione-ordine-paradise-2026-10-06` (1156532043777) was uploaded without release. Backend read verified against order #24717 locally, with an authenticated token for the current operator. Production backend configuration and deployment are still required before release.
