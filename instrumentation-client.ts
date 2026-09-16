import * as Sentry from "@sentry/nextjs";
import { glitchtipOptions } from "./lib/glitchtip";

Sentry.init({
  ...glitchtipOptions,
  integrations: defaults => defaults.filter(integration => ["InboundFilters", "FunctionToString", "BrowserApiErrors", "GlobalHandlers", "LinkedErrors", "Dedupe"].includes(integration.name)),
});

// The SDK expects this hook; tracing remains disabled by the zero sample rate.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
