import { bindQueries } from "./bind-queries.js";
import { logWidget, type PrettyWidgetOptions } from "./pretty-widget.js";
import { logRoles } from "./role-helpers.js";
import { captureAndSaveScreenshot, type ScreenshotOptions, type WindowSelector } from "./screenshot.js";
import type { Container } from "./traversal.js";
import type { BoundQueries, ScreenshotResult } from "./types.js";

let currentRoot: Container | null = null;

/** Sets the scope the `screen` queries operate against; called by `render`. */
export const setScreenRoot = (root: Container | null): void => {
    currentRoot = root;
};

const getRoot = (): Container => {
    if (!currentRoot) {
        throw new Error("No render has been performed: call render() before using screen queries");
    }

    return currentRoot;
};

const boundQueries = bindQueries(getRoot);

/**
 * Global query object for accessing rendered components.
 *
 * Provides the same query methods as render result, but automatically
 * uses the most recently rendered application as the container.
 *
 * @example
 * ```tsx
 * import { render, screen } from "@gtkx/testing";
 *
 * test("finds button", async () => {
 *   await render(<MyComponent />);
 *   const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
 *   expect(button).toBeDefined();
 * });
 * ```
 *
 * @see {@link render} for rendering components
 * @see {@link within} for scoped queries
 */
export const screen: BoundQueries & {
    debug: (container?: Container | Container[], options?: PrettyWidgetOptions) => void;
    logRoles: () => void;
    screenshot: (selector?: WindowSelector, options?: ScreenshotOptions) => Promise<ScreenshotResult>;
} = {
    ...boundQueries,
    /** Print the widget tree to console for debugging, defaulting to the screen root */
    debug: (container: Container | Container[] = getRoot(), options?: PrettyWidgetOptions): void => {
        logWidget(container, options);
    },
    /** Log all accessible roles to console for debugging */
    logRoles: (): void => {
        logRoles(getRoot());
    },
    /**
     * Capture a screenshot of a toplevel window, save it to a temp file, and
     * log a clickable `file://` URI.
     *
     * @param selector - Window selector: index (number), title substring (string), or title pattern (RegExp).
     *                   If omitted, captures the first window.
     * @param options - Optional timeout and interval configuration for waiting on widget rendering.
     * @returns Screenshot result containing base64-encoded PNG data
     *
     * @example
     * ```tsx
     * await screen.screenshot();              // First window
     * await screen.screenshot(0);             // Window at index 0
     * await screen.screenshot("Settings");    // Window with title containing "Settings"
     * await screen.screenshot(/^My App/);     // Window with title matching regex
     * ```
     */
    screenshot: (selector?: WindowSelector, options?: ScreenshotOptions): Promise<ScreenshotResult> =>
        captureAndSaveScreenshot(selector, options),
};
