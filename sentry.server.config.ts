import * as Sentry from "@sentry/nextjs";
import { glitchtipOptions } from "./lib/glitchtip";

Sentry.init({
  ...glitchtipOptions,
  integrations: defaults => defaults.filter(integration => ["InboundFilters", "FunctionToString", "OnUncaughtException", "OnUnhandledRejection", "LinkedErrors", "Dedupe"].includes(integration.name)),
});
