import type * as Gtk from "@gtkx/ffi/gtk";
import type { ComponentType, ReactNode } from "react";
import type { Container } from "./traversal.js";

/**
 * Custom function for matching text content.
 *
 * @param content - The normalized text content to match against
 * @param widget - The widget being tested
 * @returns `true` if the content matches
 */
export type MatcherFunction = (content: string, widget: Gtk.Widget) => boolean;

/**
 * Text matching pattern.
 *
 * Can be a string for exact/substring matching, a RegExp for pattern matching,
 * or a custom function for advanced matching logic.
 */
export type Matcher = string | RegExp | MatcherFunction;

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
export type MatcherOptions = {
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
export type ByRoleOptions = MatcherOptions & {
    /** Filter by accessible name/label */
    name?: Matcher;
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
 * A wrapper component that exposes its root GTK widget via `ref`.
 * Accept `ref` as a prop and pass it through to the root intrinsic element.
 */
/**
 * A wrapper component that receives the rendered tree as children.
 */
/**
 * A wrapper component that exposes its root GTK widget via `ref`.
 * Accept `ref` as a prop and pass it through to the root intrinsic element.
 */
/**
 * A wrapper component that receives the rendered tree as children.
 */
export type WrapperComponent = ComponentType<{
    children: ReactNode;
}>;

/**
 * Options for {@link render}.
 */
export type RenderOptions = {
    /**
     * Wrapper component or boolean.
     * - `true` (default): Wrap in GtkApplicationWindow
     * - `false`: No wrapper
     * - Component: Custom wrapper that passes `ref` to its root element
     */
    wrapper?: boolean | WrapperComponent;
    /**
     * The element queries are bound to.
     * Defaults to the GTK Application (searches all toplevel windows).
     * Provide a specific widget or application to scope queries.
     */
    baseElement?: Container;
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
    queryByLabelText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget | null;
    /** Query single element by visible text (returns null if not found) */
    queryByText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget | null;
    /** Query single element by widget name (returns null if not found) */
    queryByName: (name: Matcher, options?: MatcherOptions) => Gtk.Widget | null;
    /** Query all elements by accessible role (returns empty array if none found) */
    queryAllByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Gtk.Widget[];
    /** Query all elements by label/text content (returns empty array if none found) */
    queryAllByLabelText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    /** Query all elements by visible text (returns empty array if none found) */
    queryAllByText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    /** Query all elements by widget name (returns empty array if none found) */
    queryAllByName: (name: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    /** Get single element by accessible role (throws if not found or multiple match) */
    getByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Gtk.Widget;
    /** Get single element by label/text content (throws if not found or multiple match) */
    getByLabelText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget;
    /** Get single element by visible text (throws if not found or multiple match) */
    getByText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget;
    /** Get single element by widget name (throws if not found or multiple match) */
    getByName: (name: Matcher, options?: MatcherOptions) => Gtk.Widget;
    /** Get all elements by accessible role (throws if none found) */
    getAllByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Gtk.Widget[];
    /** Get all elements by label/text content (throws if none found) */
    getAllByLabelText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    /** Get all elements by visible text (throws if none found) */
    getAllByText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    /** Get all elements by widget name (throws if none found) */
    getAllByName: (name: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    /** Find single element by accessible role (waits and throws if not found) */
    findByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Promise<Gtk.Widget>;
    /** Find single element by label/text content (waits and throws if not found) */
    findByLabelText: (text: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget>;
    /** Find single element by visible text (waits and throws if not found) */
    findByText: (text: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget>;
    /** Find single element by widget name (waits and throws if not found) */
    findByName: (name: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget>;
    /** Find all elements by accessible role (waits and throws if none found) */
    findAllByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Promise<Gtk.Widget[]>;
    /** Find all elements by label/text content (waits and throws if none found) */
    findAllByLabelText: (text: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget[]>;
    /** Find all elements by visible text (waits and throws if none found) */
    findAllByText: (text: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget[]>;
    /** Find all elements by widget name (waits and throws if none found) */
    findAllByName: (name: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget[]>;
};

/**
 * Result returned by {@link render}.
 *
 * Provides query methods and utilities for testing rendered components.
 */
export type RenderResult = BoundQueries & {
    /** The direct container widget wrapping the rendered content */
    container: Gtk.Widget;
    /** The element queries are bound to (defaults to the GTK Application) */
    baseElement: Container;
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
 *
 * `initialProps` is required when `Props` is a non-optional type, and optional
 * when `Props` accepts `undefined`. The `wrapper` field is always optional.
 */
export type RenderHookOptions<Props> = {
    /**
     * Wrapper component or boolean.
     * - `true` (default): Wrap in GtkApplicationWindow
     * - `false`: No wrapper
     * - Component: Custom wrapper that passes `ref` to its root element
     */
    wrapper?: boolean | WrapperComponent;
} & (undefined extends Props
    ? {
          /**
           * Initial props passed to the hook callback.
           */
          initialProps?: Props;
      }
    : {
          /**
           * Initial props passed to the hook callback.
           */
          initialProps: Props;
      });

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
