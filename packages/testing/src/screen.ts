import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as Gtk from "@gtkx/gi/gtk";
import { bindQueries } from "./bind-queries.js";
import { prettyWidget } from "./pretty-widget.js";
import { logRoles } from "./role-helpers.js";
import { screenshot as captureScreenshot, type ScreenshotOptions } from "./screenshot.js";
import type { ScreenshotResult } from "./types.js";

let currentRoot: Gtk.Application | null = null;

/** Sets the application the `screen` queries operate against; called by `render`. */
export const setScreenRoot = (root: Gtk.Application | null): void => {
    currentRoot = root;
};

const getRoot = (): Gtk.Application => {
    if (!currentRoot) {
        throw new Error("No render has been performed: call render() before using screen queries");
    }

    return currentRoot;
};

type WindowSelector = number | string | RegExp | undefined;

const resolveWindow = (selector?: WindowSelector): Gtk.Window => {
    const windows = Gtk.Window.listToplevels();

    if (windows.length === 0) {
        throw new Error("No windows available for screenshot");
    }

    if (selector === undefined) {
        const [first] = windows;
        if (!(first instanceof Gtk.Window)) {
            throw new TypeError("First toplevel is not a Window");
        }
        return first;
    }

    if (typeof selector === "number") {
        const indexed = windows[selector];
        if (!(indexed instanceof Gtk.Window)) {
            throw new TypeError(`Window at index ${selector} not found`);
        }
        return indexed;
    }

    const isRegex = selector instanceof RegExp;
    const found = windows.find((w): w is Gtk.Window => {
        if (!(w instanceof Gtk.Window)) return false;
        const title = w.getTitle() ?? "";
        return isRegex ? selector.test(title) : title.includes(selector);
    });

    if (!found) {
        const pattern = isRegex ? selector.toString() : `"${selector}"`;
        throw new Error(`No window found with title matching ${pattern}`);
    }
    return found;
};

const saveScreenshotToTempFile = (result: ScreenshotResult): string => {
    const dir = join(tmpdir(), "gtkx-screenshots");
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    const filepath = join(dir, `${Date.now()}-screenshot.png`);
    writeFileSync(filepath, Buffer.from(result.data, "base64"));
    return filepath;
};

/**
 * Logs a `file://` URI for the given screenshot path to the console.
 */
export const logScreenshotPath = (filepath: string): void => {
    console.log(`Screenshot saved: file://${filepath}`);
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
export const screen = {
    ...boundQueries,
    /** Print the widget tree to console for debugging */
    debug: () => {
        console.log(prettyWidget(getRoot()));
    },
    /** Log all accessible roles to console for debugging */
    logRoles: () => {
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
    screenshot: async (selector?: WindowSelector, options?: ScreenshotOptions): Promise<ScreenshotResult> => {
        const target = resolveWindow(selector);
        const result = await captureScreenshot(target, options);
        const filepath = saveScreenshotToTempFile(result);
        logScreenshotPath(filepath);
        return result;
    },
};
