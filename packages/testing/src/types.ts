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

/**
 * Constraints on a widget's numeric range value used by role queries. The numbers come from the
 * accessibility tree and match within 0.001, the resolution GTK keeps them to.
 */
type ByRoleValue = {
    /** The current value. */
    now?: number | undefined;
    /** The lower bound of the value's range. */
    min?: number | undefined;
    /**
     * The highest value the widget can reach, which on a paged widget such as a scrollbar is its
     * adjustment's upper bound less one page.
     */
    max?: number | undefined;
    /** Matcher for the value's textual representation. */
    text?: Matcher | undefined;
};

/** Options for role queries: an accessible name matcher plus accessible state and value constraints. */
type ByRoleOptions<T extends Gtk.Widget = Gtk.Widget> = MatcherOptions<T> & {
    /** Matcher for the widget's accessible name. */
    name?: Matcher | undefined;
    /** Required checked state; a mixed check button reads as neither, so it matches neither value. */
    checked?: boolean | undefined;
    /** Required active state of a toggle button; any other widget matches neither value. */
    pressed?: boolean | undefined;
    /** Required selected state of a row, list item, grid cell, option or tree item. */
    selected?: boolean | undefined;
    /** Required expanded state of an expander or tree expander. */
    expanded?: boolean | undefined;
    /** Heading or hierarchy level. */
    level?: number | undefined;
    /** Required busy state, which an unset state satisfies as false. */
    busy?: boolean | undefined;
    /** Matcher for the widget's own accessible description, ignoring its `described-by` targets. */
    description?: Matcher | undefined;
    /** Constraints on the widget's range value, each checked only when given. */
    value?: ByRoleValue | undefined;
    /** When true, include widgets excluded from the accessibility tree. Widgets that are not mapped stay excluded. */
    hidden?: boolean | undefined;
};

/** A React component that wraps rendered content, receiving it as its children. */
type WrapperComponent = ComponentType<{
    children: ReactNode;
}>;

/** A custom query, taking the scope to search as its first argument and its matcher arguments after it. */
type Query = (container: Container, ...args: never[]) => unknown;
/** Custom queries keyed by the name each is bound under. */
type QueryMap = Record<string, Query>;

/** A query with its container argument already applied. */
type BoundQuery<Q extends Query> = Q extends (container: Container, ...args: infer A) => infer R
    ? (...args: A) => R
    : never;

/** Custom queries with their container argument already applied, keyed as they were passed in. */
type BoundCustomQueries<Q extends QueryMap> = { [K in keyof Q]: BoundQuery<Q[K]> };

/** What each variant of a query family yields for the widget type it matched. */
type QueryFamilyReturns<T extends Gtk.Widget> = {
    /** The single match, or null when nothing matched; throws when more than one matched. */
    queryBy: T | null;
    /** Every match, empty when nothing matched. */
    queryAllBy: T[];
    /** The single match; throws when nothing or more than one matched. */
    getBy: T;
    /** Every match; throws when nothing matched. */
    getAllBy: T[];
    /** The single match, retried until it appears or the timeout elapses. */
    findBy: Promise<T>;
    /** Every match, retried until at least one appears or the timeout elapses. */
    findAllBy: Promise<T[]>;
};

/** What a query family matches against, which fixes the arguments it takes. */
type QueryKind = "role" | "text" | "name" | "value";

/** The arguments a query of the given kind takes after the family's leading ones. */
type QueryArgs<Kind extends QueryKind, T extends Gtk.Widget> = Kind extends "role"
    ? [role: Gtk.AccessibleRole, options?: ByRoleOptions<T>]
    : Kind extends "name"
        ? [name: Matcher, options?: MatcherOptions<T>]
        : Kind extends "value"
            ? [value: Matcher, options?: MatcherOptions<T>]
            : [text: Matcher, options?: MatcherOptions<T>];

/**
 * One family's query variants, each named for its variant followed by `Suffix` and taking `Head`
 * ahead of the family's own arguments.
 */
type QueryFamily<Suffix extends string, Kind extends QueryKind, Head extends unknown[]> = {
    [K in keyof QueryFamilyReturns<Gtk.Widget> as `${K & string}${Suffix}`]: <T extends Gtk.Widget = Gtk.Widget>(
        ...args: [...Head, ...QueryArgs<Kind, T>]
    ) => QueryFamilyReturns<T>[K];
};

/**
 * Every built-in query, spanning the Role, LabelText, Text, Name, PlaceholderText, and DisplayValue
 * families, with `Head` prepended to each signature.
 */
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
    /** Widget or root element to mount into; an undecorated harness window is created when omitted. */
    container?: Gtk.Widget | RootElement | undefined;
    /** Root of the subtree that bound queries search. */
    baseElement?: Container | undefined;
    /** Component wrapped around the rendered element, such as a context provider. */
    wrapper?: WrapperComponent | undefined;
    /** Render inside React StrictMode. */
    isReactStrictMode?: boolean | undefined;
    /** Enable widget animations during the test. */
    areAnimationsEnabled?: boolean | undefined;
    /** Called for errors caught by React error boundaries. */
    onCaughtError?: ((error: unknown, errorInfo: ErrorInfo) => void) | undefined;
    /** Called for errors React recovered from automatically. */
    onRecoverableError?: ((error: unknown, errorInfo: ErrorInfo) => void) | undefined;
    /** Custom queries to bind to the rendered result. */
    queries?: Q | undefined;
};

/** Console helpers bundled with the bound queries on {@link screen} and on a render result. */
type DebugUtilities = {
    /** Prints the widget tree of the given containers, or of the whole scope, to the console. */
    debug: (element?: Container | Container[], options?: PrettyWidgetOptions) => void;
    /** Prints the accessible roles found in the scope, with the widgets carrying each one. */
    logRoles: () => void;
    /**
     * Captures what is on screen, which is the active toplevel window: GTK4 exposes no position for
     * a toplevel, so windows cannot be composited into a single image.
     */
    screenshot: (options?: ScreenshotOptions) => Promise<ScreenshotResult>;
};

/** A captured screenshot: base64-encoded image data, its MIME type, and pixel dimensions. */
type ScreenshotResult = {
    /** Base64-encoded image bytes. */
    data: string;
    /** MIME type of the encoded image, always `image/png`. */
    mimeType: string;
    /** Image width in pixels, after the scale factor is applied. */
    width: number;
    /** Image height in pixels, after the scale factor is applied. */
    height: number;
};

/**
 * Options for capturing a screenshot: the poll timeout and interval, a rendering scale factor, and
 * a file to write the PNG to.
 */
type ScreenshotOptions = Pick<WaitForOptions, "timeout" | "interval"> & {
    /** Device scale factor applied when rendering. */
    scale?: number | undefined;
    /** File the PNG is written to, with its parent directories created as needed. */
    path?: string | undefined;
};

/**
 * Options for {@link renderHook}: an optional wrapper and the initial props (required unless the
 * props type permits undefined).
 */
type RenderHookOptions<Props> = {
    /** Component wrapped around the one calling the hook, such as a context provider. */
    wrapper?: WrapperComponent;
} & (undefined extends Props
    ? {
            /** Props the hook is invoked with until `rerender` is given new ones. */
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
    /** Stable object the hook's return value is written to on every render. */
    result: {
        /** The hook's latest return value. */
        current: Result;
    };
    /** Re-invokes the hook, keeping the previous props when none are given. */
    rerender: (newProps?: Props) => Promise<void>;
    /** Unmounts the component that calls the hook. */
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
    type RenderHookOptions,
    type RenderHookResult,
};
