import type * as Gtk from "@gtkx/gi/gtk";
import type { RootElement } from "@gtkx/react";
import type { ComponentType, ErrorInfo, ReactNode } from "react";
import type { PrettyWidgetOptions } from "./pretty-widget.js";
import type { Container } from "./traversal.js";

/**
 * A custom matcher predicate: given a candidate widget's normalized text content and the widget
 * itself, returns whether it matches.
 */
type MatcherFunction = (content: string, widget: Gtk.Widget) => boolean;
/** A value used to match widget text: a string or number, a regular expression, or a custom {@link MatcherFunction}. */
type Matcher = string | number | RegExp | MatcherFunction;
/** Normalizes a widget's text before it is compared against a matcher. */
type NormalizerFn = (text: string) => string;
/**
 * A widget class usable as a query's `as` constraint, such as `Gtk.Button`. Abstract classes and
 * generated GInterface pseudo-classes are accepted.
 */
type WidgetType<T extends Gtk.Widget = Gtk.Widget> = abstract new (...args: never[]) => T;

/** Options controlling the default text normalizer. */
type NormalizerOptions = {
    /** Trim leading and trailing whitespace. */
    trim?: boolean | undefined;
    /** Collapse runs of whitespace into a single space. */
    collapseWhitespace?: boolean | undefined;
};

/** Options controlling how asynchronous queries and waits poll for a condition. */
type WaitForOptions = {
    /** Maximum time in milliseconds to keep retrying before failing. */
    timeout?: number | undefined;
    /** Delay in milliseconds between retries. */
    interval?: number | undefined;
    /** Transforms the error thrown when the timeout elapses. */
    onTimeout?: ((error: Error) => Error) | undefined;
    /** Error whose stack trace attributes the timeout failure to the calling code. */
    stackTraceError?: Error | undefined;
};

/** Options controlling text matching and, for asynchronous queries, polling behavior. */
type MatcherOptions<T extends Gtk.Widget = Gtk.Widget> = {
    /** When true (the default), require an exact match; when false, match case-insensitively as a substring. */
    exact?: boolean | undefined;
    /** Custom normalizer replacing the default; cannot be combined with `trim` or `collapseWhitespace`. */
    normalizer?: NormalizerFn | undefined;
    /** Forwarded to the default normalizer when no custom `normalizer` is given. */
    trim?: boolean | undefined;
    /** Forwarded to the default normalizer when no custom `normalizer` is given. */
    collapseWhitespace?: boolean | undefined;
    /** Whether to include a suggested better query in error messages. */
    suggest?: boolean | undefined;
    /** Restricts matches to instances of this widget class, and narrows the query's return type to it. */
    as?: WidgetType<T> | undefined;
} & WaitForOptions;

/** Constraints on a widget's numeric range value used by role queries. */
type ByRoleValue = {
    /** The current value. */
    now?: number | undefined;
    min?: number | undefined;
    max?: number | undefined;
    /** Matcher for the value's textual representation. */
    text?: Matcher | undefined;
};

/** Options for role queries: an accessible name matcher plus accessible state and value constraints. */
type ByRoleOptions<T extends Gtk.Widget = Gtk.Widget> = MatcherOptions<T> & {
    name?: Matcher | undefined;
    checked?: boolean | undefined;
    pressed?: boolean | undefined;
    selected?: boolean | undefined;
    expanded?: boolean | undefined;
    /** Heading or hierarchy level. */
    level?: number | undefined;
    busy?: boolean | undefined;
    description?: Matcher | undefined;
    value?: ByRoleValue | undefined;
    /** When true, include widgets excluded from the accessibility tree. */
    hidden?: boolean | undefined;
};

/** A React component that wraps rendered content, receiving it as its children. */
type WrapperComponent = ComponentType<{
    children: ReactNode;
}>;

type Query = (container: Container, ...args: never[]) => unknown;
type QueryMap = Record<string, Query>;

type BoundQuery<Q extends Query> = Q extends (container: Container, ...args: infer A) => infer R
    ? (...args: A) => R
    : never;

type BoundCustomQueries<Q extends QueryMap> = { [K in keyof Q]: BoundQuery<Q[K]> };

type QueryFamilyReturns<T extends Gtk.Widget> = {
    queryBy: T | null;
    queryAllBy: T[];
    getBy: T;
    getAllBy: T[];
    findBy: Promise<T>;
    findAllBy: Promise<T[]>;
};

type QueryKind = "role" | "text" | "name" | "value";

type QueryArgs<Kind extends QueryKind, T extends Gtk.Widget> = Kind extends "role"
    ? [role: Gtk.AccessibleRole, options?: ByRoleOptions<T>]
    : Kind extends "name"
        ? [name: Matcher, options?: MatcherOptions<T>]
        : Kind extends "value"
            ? [value: Matcher, options?: MatcherOptions<T>]
            : [text: Matcher, options?: MatcherOptions<T>];

/**
 * One query family (`queryBy`, `getBy`, `findBy` and their `All` variants) for a single suffix.
 * Each member takes an explicit widget type, as Testing Library's queries do, and also infers it
 * from an `as` option.
 */
type QueryFamily<Suffix extends string, Kind extends QueryKind, Head extends unknown[]> = {
    [K in keyof QueryFamilyReturns<Gtk.Widget> as `${K & string}${Suffix}`]: <T extends Gtk.Widget = Gtk.Widget>(
        ...args: [...Head, ...QueryArgs<Kind, T>]
    ) => QueryFamilyReturns<T>[K];
};

type QueryFamilies<Head extends unknown[]> = QueryFamily<"Role", "role", Head> &
    QueryFamily<"LabelText", "text", Head> &
    QueryFamily<"Text", "text", Head> &
    QueryFamily<"Name", "name", Head> &
    QueryFamily<"PlaceholderText", "text", Head> &
    QueryFamily<"DisplayValue", "value", Head>;

/**
 * Options for {@link render}: the container and base element to mount into, an optional wrapper,
 * React behavior toggles, error callbacks, and custom queries to bind.
 */
type RenderOptions<Q extends QueryMap = Record<never, never>> = {
    container?: Gtk.Widget | RootElement | undefined;
    /** Root of the subtree that bound queries search. */
    baseElement?: Container | undefined;
    wrapper?: WrapperComponent | undefined;
    /** Render inside React StrictMode. */
    reactStrictMode?: boolean | undefined;
    /** Enable widget animations during the test. */
    animations?: boolean | undefined;
    /** Called for errors caught by React error boundaries. */
    onCaughtError?: ((error: unknown, errorInfo: ErrorInfo) => void) | undefined;
    /** Called for errors React recovered from automatically. */
    onRecoverableError?: ((error: unknown, errorInfo: ErrorInfo) => void) | undefined;
    /** Custom queries to bind to the rendered result. */
    queries?: Q | undefined;
};

type DebugUtilities = {
    debug: (element?: Container | Container[], options?: PrettyWidgetOptions) => void;
    logRoles: () => void;
    screenshot: (selector?: WindowSelector, options?: ScreenshotOptions) => Promise<ScreenshotResult>;
};

/** A captured screenshot: base64-encoded image data, its MIME type, and pixel dimensions. */
type ScreenshotResult = {
    data: string;
    mimeType: string;
    width: number;
    height: number;
};

/** Options for capturing a screenshot: the poll timeout and interval, plus a rendering scale factor. */
type ScreenshotOptions = Pick<WaitForOptions, "timeout" | "interval"> & {
    /** Device scale factor applied when rendering. */
    scale?: number;
};

/**
 * Selects the window to screenshot by index, or by title (exact string or regular expression);
 * undefined targets the default window.
 */
type WindowSelector = number | string | RegExp | undefined;

/**
 * Options for {@link renderHook}: an optional wrapper and the initial props (required unless the
 * props type permits undefined).
 */
type RenderHookOptions<Props> = {
    wrapper?: WrapperComponent;
} & (undefined extends Props
    ? {
            initialProps?: Props;
        }
    : {
            initialProps: Props;
        });

/**
 * The result of {@link renderHook}: the latest hook return value plus functions to rerender with new
 * props and to unmount.
 */
type RenderHookResult<Result, Props> = {
    /** Holds the most recent value returned by the hook under `current`. */
    result: { current: Result };
    rerender: (newProps?: Props) => Promise<void>;
    unmount: () => Promise<void>;
};

export {
    type MatcherFunction,
    type Matcher,
    type NormalizerFn,
    type NormalizerOptions,
    type WaitForOptions,
    type MatcherOptions,
    type ByRoleValue,
    type ByRoleOptions,
    type WidgetType,
    type WrapperComponent,
    type QueryMap,
    type BoundCustomQueries,
    type QueryFamilies,
    type RenderOptions,
    type DebugUtilities,
    type ScreenshotResult,
    type ScreenshotOptions,
    type WindowSelector,
    type RenderHookOptions,
    type RenderHookResult,
};
