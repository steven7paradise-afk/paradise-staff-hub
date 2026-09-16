# GlitchTip — Paradise Staff Hub

Project: https://app.glitchtip.com/paradise-beauty/issues?project=27909

The public project DSN is configured in `lib/glitchtip.ts`. It grants event ingestion only, not access to issues or administrative settings. Override with `NEXT_PUBLIC_GLITCHTIP_DSN`; disable monitoring with `NEXT_PUBLIC_GLITCHTIP_ENABLED=false` (requires rebuild for the browser).

Browser unhandled exceptions, root/layout errors, page error boundaries and Next.js server request errors are captured. Errors deliberately caught by application code are not automatically reported; use `captureException(error)` where appropriate. No console logging integration is enabled.

Only allowlisted technical fields leave the application. Request bodies, URLs, headers, cookies, identities, contexts, breadcrumbs and custom exception text are omitted. Stack traces retain source basenames and line/column coordinates, without local paths or source context. Consequently, private custom error messages cannot be diagnosed from GlitchTip alone.

Session tracking, replay, tracing, logs and automatic source-map uploads are disabled. This keeps use focused on error tracking; the hosted free-plan quota still applies. The service is hosted on GlitchTip's US endpoint, not self-hosted on Coolify.

Installing this integration locally does not deploy it. The production app begins reporting only after a new deployment containing these files. No database migration is required.
