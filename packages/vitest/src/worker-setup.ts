import { inject } from "vitest";
import {
    DEFAULT_HEADLESS_SIZE,
    type HeadlessDisplayTeardown,
    type HeadlessOptions,
    startHeadlessDisplay,
} from "./headless-display.js";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const provided = inject("gtkxHeadless");

const options: HeadlessOptions = {
    size: provided.size ?? DEFAULT_HEADLESS_SIZE,
    compositor: provided.compositor ?? "weston",
};

const teardown: HeadlessDisplayTeardown = await startHeadlessDisplay(options);

let torndown = false;
const runTeardown = (): void => {
    if (torndown) return;
    torndown = true;
    teardown();
};

process.on("exit", runTeardown);
