import { inject } from "vitest";
import {
    type HeadlessOptions,
    installTeardownHandlers,
    resolveHeadlessOptions,
    startHeadlessDisplay,
} from "./headless-display.js";

declare module "vitest" {
    interface ProvidedContext {
        gtkxHeadless: Partial<HeadlessOptions>;
    }
}

const teardown = await startHeadlessDisplay(resolveHeadlessOptions(inject("gtkxHeadless")));
installTeardownHandlers(teardown);
