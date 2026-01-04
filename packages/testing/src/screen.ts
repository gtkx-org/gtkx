import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type * as Gtk from "@gtkx/ffi/gtk";
import * as queries from "./queries.js";
import { type ScreenshotOptions, screenshot as screenshotWidget } from "./screenshot.js";
import type { ByRoleOptions, ScreenshotResult, TextMatch, TextMatchOptions } from "./types.js";
import { prettyWidget } from "./index.js";

const getScreenshotDir = (): string => {
    const dir = join(tmpdir(), "gtkx-screenshots");
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    return dir;
};

const saveAndLogScreenshot = (result: ScreenshotResult): void => {
    const dir = getScreenshotDir();
    const filename = `${Date.now()}-screenshot.png`;
    const filepath = join(dir, filename);
    const buffer = Buffer.from(result.data, "base64");
    writeFileSync(filepath, buffer);
    console.log(`Screenshot saved: file://${filepath}`);
};

let currentRoot: Gtk.Application | null = null;

/** @internal */
export const setScreenRoot = (root: Gtk.Application | null): void => {
    currentRoot = root;
};

const getRoot = (): Gtk.Application => {
    if (!currentRoot) {
        throw new Error("No render has been performed: call render() before using screen queries");
    }

    return currentRoot;
};

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
    /** Find single element by accessible role */
    findByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => queries.findByRole(getRoot(), role, options),
    /** Find single element by label/text content */
    findByLabelText: (text: TextMatch, options?: TextMatchOptions) => queries.findByLabelText(getRoot(), text, options),
    /** Find single element by visible text */
    findByText: (text: TextMatch, options?: TextMatchOptions) => queries.findByText(getRoot(), text, options),
    /** Find single element by test ID (widget name) */
    findByTestId: (testId: TextMatch, options?: TextMatchOptions) => queries.findByTestId(getRoot(), testId, options),
    /** Find all elements by accessible role */
    findAllByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) =>
        queries.findAllByRole(getRoot(), role, options),
    /** Find all elements by label/text content */
    findAllByLabelText: (text: TextMatch, options?: TextMatchOptions) =>
        queries.findAllByLabelText(getRoot(), text, options),
    /** Find all elements by visible text */
    findAllByText: (text: TextMatch, options?: TextMatchOptions) => queries.findAllByText(getRoot(), text, options),
    /** Find all elements by test ID (widget name) */
    findAllByTestId: (testId: TextMatch, options?: TextMatchOptions) =>
        queries.findAllByTestId(getRoot(), testId, options),
    /** Print the widget tree to console for debugging */
    debug: () => {
        console.log(prettyWidget(getRoot()));
    },
    /**
     * Capture a screenshot of the application window, saving it to a temporary file and logging the file path.
     *
     * @param selector - Window selector: index (number), title substring (string), or title pattern (RegExp).
     *                   If omitted, captures the first window.
     * @param options - Optional timeout and interval configuration for waiting on widget rendering.
     * @returns Screenshot result containing base64-encoded PNG data
     * @throws Error if no windows are available or no matching window is found
     *
     * @example
     * ```tsx
     * await screen.screenshot();              // First window
     * await screen.screenshot(0);             // Window at index 0
     * await screen.screenshot("Settings");    // Window with title containing "Settings"
     * await screen.screenshot(/^My App/);     // Window with title matching regex
     * ```
     */
    screenshot: async (selector?: number | string | RegExp, options?: ScreenshotOptions): Promise<ScreenshotResult> => {
        const root = getRoot();
        const windows = root.getWindows();

        if (windows.length === 0) {
            throw new Error("No windows available for screenshot");
        }

        let targetWindow: Gtk.Window | undefined;

        if (selector === undefined) {
            targetWindow = windows[0] as Gtk.Window;
        } else if (typeof selector === "number") {
            targetWindow = windows[selector] as Gtk.Window | undefined;
            if (!targetWindow) {
                throw new Error(`Window at index ${selector} not found`);
            }
        } else {
            const isRegex = selector instanceof RegExp;
            targetWindow = windows.find((w) => {
                const title = (w as Gtk.Window).getTitle() ?? "";
                return isRegex ? selector.test(title) : title.includes(selector);
            }) as Gtk.Window | undefined;

            if (!targetWindow) {
                const pattern = isRegex ? selector.toString() : `"${selector}"`;
                throw new Error(`No window found with title matching ${pattern}`);
            }
        }

        const result = await screenshotWidget(targetWindow, options);
        saveAndLogScreenshot(result);
        return result;
    },
};
