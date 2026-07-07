import {
    type HeadlessOptions,
    installTeardownHandlers,
    resolveHeadlessOptions,
    startHeadlessDisplay,
} from "./headless-display.js";

export const bootstrapHeadlessDisplay = async (options: Partial<HeadlessOptions>): Promise<void> => {
    const teardown = await startHeadlessDisplay(resolveHeadlessOptions(options));
    installTeardownHandlers(teardown);
};
