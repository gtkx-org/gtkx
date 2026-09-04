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
    reapStaleHeadlessDisplaysAtStartup,
    type StaleHeadlessDisplay,
} from "./reap-headless-displays.js";
