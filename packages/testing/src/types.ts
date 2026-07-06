import type * as Gtk from "@gtkx/gi/gtk";
import type { RootElement } from "@gtkx/react";
import type { ComponentType, ErrorInfo, ReactNode } from "react";
import type { PrettyWidgetOptions } from "./pretty-widget.js";
import type { Container } from "./traversal.js";

export type MatcherFunction = (content: string, widget: Gtk.Widget) => boolean;

export type Matcher = string | number | RegExp | MatcherFunction;

export type NormalizerFn = (text: string) => string;

export type NormalizerOptions = {
    trim?: boolean | undefined;
    collapseWhitespace?: boolean | undefined;
};

export type WaitForOptions = {
    timeout?: number | undefined;
    interval?: number | undefined;
    onTimeout?: ((error: Error) => Error) | undefined;
    stackTraceError?: Error | undefined;
};

export type MatcherOptions = {
    exact?: boolean | undefined;
    normalizer?: NormalizerFn | undefined;
    trim?: boolean | undefined;
    collapseWhitespace?: boolean | undefined;
    suggest?: boolean | undefined;
} & WaitForOptions;

export type ByRoleValue = {
    now?: number | undefined;
    min?: number | undefined;
    max?: number | undefined;
    text?: Matcher | undefined;
};

export type ByRoleOptions = MatcherOptions & {
    name?: Matcher | undefined;
    checked?: boolean | undefined;
    pressed?: boolean | undefined;
    selected?: boolean | undefined;
    expanded?: boolean | undefined;
    level?: number | undefined;
    busy?: boolean | undefined;
    description?: Matcher | undefined;
    value?: ByRoleValue | undefined;
    hidden?: boolean | undefined;
};

export type WrapperComponent = ComponentType<{
    children: ReactNode;
}>;

type Query = (container: Container, ...args: never[]) => unknown;

export type QueryMap = Record<string, Query>;

type BoundQuery<Q extends Query> = Q extends (container: Container, ...args: infer A) => infer R
    ? (...args: A) => R
    : never;

export type BoundCustomQueries<Q extends QueryMap> = { [K in keyof Q]: BoundQuery<Q[K]> };

export type RenderOptions<Q extends QueryMap = Record<never, never>> = {
    container?: Gtk.Widget | RootElement | undefined;
    baseElement?: Container | undefined;
    wrapper?: WrapperComponent | undefined;
    reactStrictMode?: boolean | undefined;
    animations?: boolean | undefined;
    onCaughtError?: ((error: unknown, errorInfo: ErrorInfo) => void) | undefined;
    onRecoverableError?: ((error: unknown, errorInfo: ErrorInfo) => void) | undefined;
    queries?: Q | undefined;
};

export type DebugUtilities = {
    debug: (element?: Container | Container[], options?: PrettyWidgetOptions) => void;
    logRoles: () => void;
    screenshot: (selector?: WindowSelector, options?: ScreenshotOptions) => Promise<ScreenshotResult>;
};

export type ScreenshotResult = {
    data: string;
    mimeType: string;
    width: number;
    height: number;
};

export type ScreenshotOptions = Pick<WaitForOptions, "timeout" | "interval"> & {
    scale?: number;
};

export type WindowSelector = number | string | RegExp | undefined;

export type RenderHookOptions<Props> = {
    wrapper?: WrapperComponent;
} & (undefined extends Props
    ? {
          initialProps?: Props;
      }
    : {
          initialProps: Props;
      });

export type RenderHookResult<Result, Props> = {
    result: { current: Result };
    rerender: (newProps?: Props) => Promise<void>;
    unmount: () => Promise<void>;
};
