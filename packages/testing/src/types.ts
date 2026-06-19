import type * as Gtk from "@gtkx/gi/gtk";
import type { RootElement } from "@gtkx/react";
import type { ComponentType, ErrorInfo, ReactNode } from "react";
import type { PrettyWidgetOptions } from "./pretty-widget.js";
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
 * Can be a string or number for exact/substring matching, a RegExp for pattern
 * matching, or a custom function for advanced matching logic.
 */
export type Matcher = string | number | RegExp | MatcherFunction;

/**
 * Normalizes text before it is compared against a {@link Matcher}.
 *
 * @param text - The raw text extracted from a widget.
 * @returns The normalized text to match against.
 */
export type NormalizerFn = (text: string) => string;

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
 * Options for {@link waitFor} and {@link waitForElementToBeRemoved}, also
 * forwarded by the `findBy*`/`findAllBy*` queries to control polling.
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
 * Options for text-based queries. The async fields are consumed only by the
 * `findBy*`/`findAllBy*` variants, which forward them to {@link waitFor}.
 */
export type MatcherOptions = {
    /** Require exact match vs substring match (default: true) */
    exact?: boolean;
    /** Custom text normalizer function */
    normalizer?: NormalizerFn;
    /** Remove leading/trailing whitespace (default: true) */
    trim?: boolean;
    /** Replace multiple whitespace with single space (default: true) */
    collapseWhitespace?: boolean;
} & WaitForOptions;

/**
 * Accessible value filter for {@link ByRoleOptions}, mirroring the
 * `aria-valuenow`/`aria-valuemin`/`aria-valuemax`/`aria-valuetext` triad
 * (GTK's `AccessibleProperty.VALUE_*`).
 */
export type ByRoleValue = {
    /** Filter by current value (`accessibleValueNow`) */
    now?: number;
    /** Filter by minimum value (`accessibleValueMin`) */
    min?: number;
    /** Filter by maximum value (`accessibleValueMax`) */
    max?: number;
    /** Filter by human-readable value text (`accessibleValueText`) */
    text?: Matcher;
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
    /** Filter by busy state (`accessibleBusy`) */
    busy?: boolean;
    /** Filter by accessible description (`accessibleDescription`) */
    description?: Matcher;
    /** Filter by accessible value (`accessibleValue*`) */
    value?: ByRoleValue;
    /**
     * Include widgets hidden from the accessibility tree. Defaults to `false`,
     * so hidden widgets are excluded.
     */
    hidden?: boolean;
};

/**
 * A wrapper component that receives the rendered tree as `children` and renders
 * them. It does not receive or forward a `ref`.
 */
export type WrapperComponent = ComponentType<{
    children: ReactNode;
}>;

/**
 * A custom query function suitable for the `queries` render option: it takes the
 * query container as its first argument and returns any result.
 */
export type Query = (container: Container, ...args: never[]) => unknown;

/**
 * A map of custom query functions passed to {@link render} via the `queries`
 * option, or to {@link within}.
 */
export type QueryMap = Record<string, Query>;

/**
 * A {@link Query} with its leading container argument removed, as exposed on a
 * bound result.
 */
export type BoundQuery<Q extends Query> = Q extends (container: Container, ...args: infer A) => infer R
    ? (...args: A) => R
    : never;

/**
 * A {@link QueryMap} with every query bound to a container.
 */
export type BoundCustomQueries<Q extends QueryMap> = { [K in keyof Q]: BoundQuery<Q[K]> };

/**
 * Options for {@link render}.
 */
export type RenderOptions<Q extends QueryMap = Record<never, never>> = {
    /**
     * Where the element is mounted.
     * - omitted (default): a fresh, presented `Gtk.Window` is created and the
     *   element rendered into it — the analogue of Testing Library's default
     *   container.
     * - a widget: the element is rendered into it.
     * - `createRootElement()`: the element is rendered directly at the reconciler
     *   root with no host window, for a top-level element (an application or
     *   window).
     */
    container?: Gtk.Widget | RootElement;
    /**
     * The element queries are bound to.
     * Defaults to the GTK Application (searches all toplevel windows).
     * Provide a specific widget or application to scope queries.
     */
    baseElement?: Container;
    /**
     * A component rendered around the element (inside the container), for
     * supplying context providers. Re-applied on every `rerender`. Defaults to
     * none.
     */
    wrapper?: WrapperComponent;
    /**
     * Render the element inside `React.StrictMode`. Defaults to `false`.
     */
    reactStrictMode?: boolean;
    /**
     * Called when an error boundary catches an error thrown during render. The
     * error is still captured and rethrown to the caller.
     */
    onCaughtError?: (error: unknown, errorInfo: ErrorInfo) => void;
    /**
     * Called when React recovers from a concurrent-render error.
     */
    onRecoverableError?: (error: unknown, errorInfo: ErrorInfo) => void;
    /**
     * Custom query functions bound to the result alongside the built-in
     * queries, each receiving the query container as its first argument.
     */
    queries?: Q;
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
    /** Query single element by placeholder text (returns null if not found) */
    queryByPlaceholderText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget | null;
    /** Query single element by current display value (returns null if not found) */
    queryByDisplayValue: (value: Matcher, options?: MatcherOptions) => Gtk.Widget | null;
    /** Query all elements by accessible role (returns empty array if none found) */
    queryAllByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Gtk.Widget[];
    /** Query all elements by label/text content (returns empty array if none found) */
    queryAllByLabelText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    /** Query all elements by visible text (returns empty array if none found) */
    queryAllByText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    /** Query all elements by widget name (returns empty array if none found) */
    queryAllByName: (name: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    /** Query all elements by placeholder text (returns empty array if none found) */
    queryAllByPlaceholderText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    /** Query all elements by current display value (returns empty array if none found) */
    queryAllByDisplayValue: (value: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    /** Get single element by accessible role (throws if not found or multiple match) */
    getByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Gtk.Widget;
    /** Get single element by label/text content (throws if not found or multiple match) */
    getByLabelText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget;
    /** Get single element by visible text (throws if not found or multiple match) */
    getByText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget;
    /** Get single element by widget name (throws if not found or multiple match) */
    getByName: (name: Matcher, options?: MatcherOptions) => Gtk.Widget;
    /** Get single element by placeholder text (throws if not found or multiple match) */
    getByPlaceholderText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget;
    /** Get single element by current display value (throws if not found or multiple match) */
    getByDisplayValue: (value: Matcher, options?: MatcherOptions) => Gtk.Widget;
    /** Get all elements by accessible role (throws if none found) */
    getAllByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Gtk.Widget[];
    /** Get all elements by label/text content (throws if none found) */
    getAllByLabelText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    /** Get all elements by visible text (throws if none found) */
    getAllByText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    /** Get all elements by widget name (throws if none found) */
    getAllByName: (name: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    /** Get all elements by placeholder text (throws if none found) */
    getAllByPlaceholderText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    /** Get all elements by current display value (throws if none found) */
    getAllByDisplayValue: (value: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    /** Find single element by accessible role (waits and throws if not found) */
    findByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Promise<Gtk.Widget>;
    /** Find single element by label/text content (waits and throws if not found) */
    findByLabelText: (text: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget>;
    /** Find single element by visible text (waits and throws if not found) */
    findByText: (text: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget>;
    /** Find single element by widget name (waits and throws if not found) */
    findByName: (name: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget>;
    /** Find single element by placeholder text (waits and throws if not found) */
    findByPlaceholderText: (text: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget>;
    /** Find single element by current display value (waits and throws if not found) */
    findByDisplayValue: (value: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget>;
    /** Find all elements by accessible role (waits and throws if none found) */
    findAllByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Promise<Gtk.Widget[]>;
    /** Find all elements by label/text content (waits and throws if none found) */
    findAllByLabelText: (text: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget[]>;
    /** Find all elements by visible text (waits and throws if none found) */
    findAllByText: (text: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget[]>;
    /** Find all elements by widget name (waits and throws if none found) */
    findAllByName: (name: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget[]>;
    /** Find all elements by placeholder text (waits and throws if none found) */
    findAllByPlaceholderText: (text: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget[]>;
    /** Find all elements by current display value (waits and throws if none found) */
    findAllByDisplayValue: (value: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget[]>;
};

/**
 * Result returned by {@link render}.
 *
 * Provides query methods and utilities for testing rendered components. When
 * `render` is called with custom `queries`, they are bound here too.
 */
export type RenderResult<Q extends QueryMap = Record<never, never>> = BoundQueries &
    BoundCustomQueries<Q> & {
        /** The direct container widget wrapping the rendered content */
        container: Gtk.Widget;
        /** The element queries are bound to (defaults to the GTK Application) */
        baseElement: Container;
        /** Unmount the rendered component */
        unmount: () => Promise<void>;
        /** Re-render with a new element */
        rerender: (element: ReactNode) => Promise<void>;
        /**
         * Print the widget tree to console for debugging. Defaults to the
         * `baseElement`; pass a widget, an array of widgets, and/or formatting
         * options to scope or shape the output.
         */
        debug: (element?: Container | Container[], options?: PrettyWidgetOptions) => void;
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
     * A component rendered around the hook tree, for supplying context
     * providers. Re-applied on every `rerender`. Defaults to none.
     */
    wrapper?: WrapperComponent;
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
