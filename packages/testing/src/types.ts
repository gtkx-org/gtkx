import type * as Gtk from "@gtkx/gi/gtk";
import type { RootElement } from "@gtkx/react";
import type { ComponentType, ErrorInfo, ReactNode } from "react";
import type { PrettyWidgetOptions } from "./pretty-widget.js";
import type { Container } from "./traversal.js";

/** A custom matcher predicate: given a candidate widget's normalized text content and the widget itself, returns whether it matches. */
export type MatcherFunction = (content: string, widget: Gtk.Widget) => boolean;

/** A value used to match widget text: a string or number, a regular expression, or a custom {@link MatcherFunction}. */
export type Matcher = string | number | RegExp | MatcherFunction;

/** Normalizes a widget's text before it is compared against a matcher. */
export type NormalizerFn = (text: string) => string;

/** Options controlling the default text normalizer. */
export type NormalizerOptions = {
    /** Trim leading and trailing whitespace. */
    trim?: boolean | undefined;
    /** Collapse runs of whitespace into a single space. */
    collapseWhitespace?: boolean | undefined;
};

/** Options controlling how asynchronous queries and waits poll for a condition. */
export type WaitForOptions = {
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
export type MatcherOptions = {
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
} & WaitForOptions;

/** Constraints on a widget's numeric range value used by role queries. */
export type ByRoleValue = {
    /** The current value. */
    now?: number | undefined;
    min?: number | undefined;
    max?: number | undefined;
    /** Matcher for the value's textual representation. */
    text?: Matcher | undefined;
};

/** Options for role queries: an accessible name matcher plus accessible state and value constraints. */
export type ByRoleOptions = MatcherOptions & {
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
export type WrapperComponent = ComponentType<{
    children: ReactNode;
}>;

type Query = (container: Container, ...args: never[]) => unknown;

/** A map of custom query names to query functions, each taking the container as its first argument. */
export type QueryMap = Record<string, Query>;

type BoundQuery<Q extends Query> = Q extends (container: Container, ...args: infer A) => infer R
    ? (...args: A) => R
    : never;

export type BoundCustomQueries<Q extends QueryMap> = { [K in keyof Q]: BoundQuery<Q[K]> };

/** Options for {@link render}: the container and base element to mount into, an optional wrapper, React behavior toggles, error callbacks, and custom queries to bind. */
export type RenderOptions<Q extends QueryMap = Record<never, never>> = {
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

export type DebugUtilities = {
    debug: (element?: Container | Container[], options?: PrettyWidgetOptions) => void;
    logRoles: () => void;
    screenshot: (selector?: WindowSelector, options?: ScreenshotOptions) => Promise<ScreenshotResult>;
};

/** A captured screenshot: base64-encoded image data, its MIME type, and pixel dimensions. */
export type ScreenshotResult = {
    data: string;
    mimeType: string;
    width: number;
    height: number;
};

/** Options for capturing a screenshot: the poll timeout and interval, plus a rendering scale factor. */
export type ScreenshotOptions = Pick<WaitForOptions, "timeout" | "interval"> & {
    /** Device scale factor applied when rendering. */
    scale?: number;
};

/** Selects the window to screenshot by index, or by title (exact string or regular expression); undefined targets the default window. */
export type WindowSelector = number | string | RegExp | undefined;

/** Options for {@link renderHook}: an optional wrapper and the initial props (required unless the props type permits undefined). */
export type RenderHookOptions<Props> = {
    wrapper?: WrapperComponent;
} & (undefined extends Props
    ? {
          initialProps?: Props;
      }
    : {
          initialProps: Props;
      });

/** The result of {@link renderHook}: the latest hook return value plus functions to rerender with new props and to unmount. */
export type RenderHookResult<Result, Props> = {
    /** Holds the most recent value returned by the hook under `current`. */
    result: { current: Result };
    rerender: (newProps?: Props) => Promise<void>;
    unmount: () => Promise<void>;
};
