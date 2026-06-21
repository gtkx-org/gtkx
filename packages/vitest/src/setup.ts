import {
    type CompositorId,
    DEFAULT_HEADLESS_SIZE,
    type HeadlessOptions,
    type HeadlessTeardown,
    startHeadlessDisplay,
} from "./headless-display.js";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const resolveCompositor = (value: string | undefined): CompositorId => (value === "sway" ? "sway" : "weston");

const options: HeadlessOptions = {
    size: process.env["GTKX_HEADLESS_SIZE"] ?? DEFAULT_HEADLESS_SIZE,
    compositor: resolveCompositor(process.env["GTKX_COMPOSITOR"]),
};

const teardown: HeadlessTeardown = await startHeadlessDisplay(options);

let torndown = false;
const runTeardown = (): void => {
    if (torndown) return;
    torndown = true;
    teardown();
};

process.on("exit", runTeardown);
