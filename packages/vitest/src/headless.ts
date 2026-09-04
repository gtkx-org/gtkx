export {
    readHeadlessOptions,
    resolveHeadlessOptions,
    startHeadlessDisplay,
    STATIC_HEADLESS_ENV,
    type CompositorId,
    type HeadlessOptions,
} from "./headless-display.js";
export {
    findStaleHeadlessDisplays,
    reapStaleHeadlessDisplays,
    type StaleHeadlessDisplay,
} from "./reap-headless-displays.js";
