import type * as Gtk from "@gtkx/ffi/gtk";
import type { ComponentType, ReactNode } from "react";

/**
 * Custom function for matching text content.
 *
 * @param content - The normalized text content to match against
 * @param widget - The widget being tested
 * @returns `true` if the content matches
 */
export type TextMatchFunction = (content: string, widget: Gtk.Widget) => boolean;

/**
 * Text matching pattern.
 *
 * Can be a string for exact/substring matching, a RegExp for pattern matching,
 * or a custom function for advanced matching logic.
 */
export type TextMatch = string | RegExp | TextMatchFunction;

/**
 * Options for text normalization before matching.
 */
export type NormalizerOptions = {
    /** Remove leading/trailing whitespace (default: true) */
    trim?: boolean;
    /** Replace multiple whitespace characters with single space (default: true) */
    collapseWhitespace?: boolean;
};

/**
 * Options for text-based queries.
 */
export type TextMatchOptions = {
    /** Require exact match vs substring match (default: true) */
    exact?: boolean;
    /** Custom text normalizer function */
    normalizer?: (text: string) => string;
    /** Remove leading/trailing whitespace (default: true) */
    trim?: boolean;
    /** Replace multiple whitespace with single space (default: true) */
    collapseWhitespace?: boolean;
    /** Timeout in milliseconds for async queries (default: 1000) */
    timeout?: number;
};

/**
 * Options for role-based queries.
 *
 * Extends text matching options with accessible state filters.
 */
export type ByRoleOptions = TextMatchOptions & {
    /** Filter by accessible name/label */
    name?: TextMatch;
    /** Filter by checked state (checkboxes, radios, toggles) */
    checked?: boolean;
    /** Filter by pressed state */
    pressed?: boolean;
    /** Filter by selected state */
    selected?: boolean;
    /** Filter by expanded state (expanders) */
    expanded?: boolean;
    /** Filter by heading level */
    level?: number;
};

/**
 * Options for {@link waitFor} and {@link waitForElementToBeRemoved}.
 */
export type WaitForOptions = {
    /** Maximum time to wait in milliseconds (default: 1000) */
    timeout?: number;
    /** Polling interval in milliseconds (default: 50) */
    interval?: number;
    /** Custom error handler called on timeout */
    onTimeout?: (error: Error) => Error;
};

/**
 * Options for {@link render}.
 */
export type RenderOptions = {
    /**
     * Wrapper component or boolean.
     * - `true` (default): Wrap in GtkApplicationWindow
     * - `false`: No wrapper
     * - Component: Custom wrapper component
     */
    wrapper?: boolean | ComponentType<{ children: ReactNode }>;
};

/**
 * Query methods bound to a container.
 *
 * @see {@link screen} for global queries
 * @see {@link within} for scoped queries
 */
export type BoundQueries = {
    /** Query single element by accessible role (returns null if not found) */
    queryByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Gtk.Widget | null;
    /** Query single element by label/text content (returns null if not found) */
    queryByLabelText: (text: TextMatch, options?: TextMatchOptions) => Gtk.Widget | null;
    /** Query single element by visible text (returns null if not found) */
    queryByText: (text: TextMatch, options?: TextMatchOptions) => Gtk.Widget | null;
    /** Query single element by test ID (returns null if not found) */
    queryByTestId: (testId: TextMatch, options?: TextMatchOptions) => Gtk.Widget | null;
    /** Query all elements by accessible role (returns empty array if none found) */
    queryAllByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Gtk.Widget[];
    /** Query all elements by label/text content (returns empty array if none found) */
    queryAllByLabelText: (text: TextMatch, options?: TextMatchOptions) => Gtk.Widget[];
    /** Query all elements by visible text (returns empty array if none found) */
    queryAllByText: (text: TextMatch, options?: TextMatchOptions) => Gtk.Widget[];
    /** Query all elements by test ID (returns empty array if none found) */
    queryAllByTestId: (testId: TextMatch, options?: TextMatchOptions) => Gtk.Widget[];
    /** Find single element by accessible role (waits and throws if not found) */
    findByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Promise<Gtk.Widget>;
    /** Find single element by label/text content (waits and throws if not found) */
    findByLabelText: (text: TextMatch, options?: TextMatchOptions) => Promise<Gtk.Widget>;
    /** Find single element by visible text (waits and throws if not found) */
    findByText: (text: TextMatch, options?: TextMatchOptions) => Promise<Gtk.Widget>;
    /** Find single element by test ID (waits and throws if not found) */
    findByTestId: (testId: TextMatch, options?: TextMatchOptions) => Promise<Gtk.Widget>;
    /** Find all elements by accessible role (waits and throws if none found) */
    findAllByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Promise<Gtk.Widget[]>;
    /** Find all elements by label/text content (waits and throws if none found) */
    findAllByLabelText: (text: TextMatch, options?: TextMatchOptions) => Promise<Gtk.Widget[]>;
    /** Find all elements by visible text (waits and throws if none found) */
    findAllByText: (text: TextMatch, options?: TextMatchOptions) => Promise<Gtk.Widget[]>;
    /** Find all elements by test ID (waits and throws if none found) */
    findAllByTestId: (testId: TextMatch, options?: TextMatchOptions) => Promise<Gtk.Widget[]>;
};

/**
 * Result returned by {@link render}.
 *
 * Provides query methods and utilities for testing rendered components.
 */
export type RenderResult = BoundQueries & {
    /** The GTK Application container */
    container: Gtk.Application;
    /** Unmount the rendered component */
    unmount: () => Promise<void>;
    /** Re-render with a new element */
    rerender: (element: ReactNode) => Promise<void>;
    /** Print the widget tree to console for debugging */
    debug: () => void;
};

/**
 * Result returned by {@link screenshot} and screen.screenshot.
 */
export type ScreenshotResult = {
    /** Base64-encoded PNG image data */
    data: string;
    /** MIME type of the image (always "image/png") */
    mimeType: string;
    /** Width of the captured image in pixels */
    width: number;
    /** Height of the captured image in pixels */
    height: number;
};

/**
 * Options for {@link renderHook}.
 */
export type RenderHookOptions<Props> = {
    /**
     * Initial props passed to the hook callback.
     */
    initialProps?: Props;
    /**
     * Wrapper component or boolean.
     * - `false` (default): No wrapper
     * - `true`: Wrap in GtkApplicationWindow
     * - Component: Custom wrapper component
     */
    wrapper?: boolean | ComponentType<{ children: ReactNode }>;
};

/**
 * Result returned by {@link renderHook}.
 *
 * Provides access to the hook result and utilities for re-rendering and cleanup.
 */
export type RenderHookResult<Result, Props> = {
    /** Object containing the current hook return value */
    result: { current: Result };
    /** Re-render the hook with optional new props */
    rerender: (newProps?: Props) => Promise<void>;
    /** Unmount the component containing the hook */
    unmount: () => Promise<void>;
};
