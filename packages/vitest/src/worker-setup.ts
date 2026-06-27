import { inject } from "vitest";
import { DEFAULT_HEADLESS_SIZE, type HeadlessOptions, startHeadlessDisplay } from "./headless-display.js";

declare module "vitest" {
    interface ProvidedContext {
        gtkxHeadless: Partial<HeadlessOptions>;
    }
}

const provided = inject("gtkxHeadless");

const options: HeadlessOptions = {
    size: provided.size ?? DEFAULT_HEADLESS_SIZE,
    compositor: provided.compositor ?? "weston",
};

const teardown = await startHeadlessDisplay(options);

let torndown = false;
const runTeardown = (): void => {
    if (torndown) return;
    torndown = true;
    teardown();
};

process.on("exit", runTeardown);
