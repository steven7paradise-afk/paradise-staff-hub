import * as Sentry from "@sentry/nextjs";
import { glitchtipOptions } from "./lib/glitchtip";

Sentry.init({ ...glitchtipOptions, defaultIntegrations: false });
