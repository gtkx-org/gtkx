import {
    type HeadlessOptions,
    installTeardownHandlers,
    resolveHeadlessOptions,
    startHeadlessDisplay,
} from "./headless-display.js";

/**
 * Boots the per-worker headless display before any other module evaluates.
 *
 * The plugin injects this module into each test worker through a node
 * `--import` preload, so the private compositor and D-Bus session are live and
 * the display environment is redirected before vitest evaluates setup files.
 * Project setup files may therefore import GTK-initializing modules (such as
 * `@gtkx/gi/gtk`, which connects to the display as an import side effect)
 * without ever reaching the developer's real session compositor.
 */
export const bootstrapHeadlessDisplay = async (options: Partial<HeadlessOptions>): Promise<void> => {
    const teardown = await startHeadlessDisplay(resolveHeadlessOptions(options));
    installTeardownHandlers(teardown);
};
