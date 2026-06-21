import { type HeadlessOptions, startHeadlessDisplay } from "./headless-display.js";

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const options: HeadlessOptions = {
    size: process.env["GTKX_HEADLESS_SIZE"] ?? "1024x768",
    compositor: process.env["GTKX_COMPOSITOR"] ?? "",
};

await startHeadlessDisplay(options);
