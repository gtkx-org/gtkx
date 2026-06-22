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

export type Query = (container: Container, ...args: never[]) => unknown;

export type QueryMap = Record<string, Query>;

export type BoundQuery<Q extends Query> = Q extends (container: Container, ...args: infer A) => infer R
    ? (...args: A) => R
    : never;

export type BoundCustomQueries<Q extends QueryMap> = { [K in keyof Q]: BoundQuery<Q[K]> };

export type RenderOptions<Q extends QueryMap = Record<never, never>> = {
    container?: Gtk.Widget | RootElement | undefined;
    baseElement?: Container | undefined;
    wrapper?: WrapperComponent | undefined;
    reactStrictMode?: boolean | undefined;
    onCaughtError?: ((error: unknown, errorInfo: ErrorInfo) => void) | undefined;
    onRecoverableError?: ((error: unknown, errorInfo: ErrorInfo) => void) | undefined;
    queries?: Q | undefined;
};

export type BoundQueries = {
    queryByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Gtk.Widget | null;
    queryByLabelText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget | null;
    queryByText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget | null;
    queryByName: (name: Matcher, options?: MatcherOptions) => Gtk.Widget | null;
    queryByPlaceholderText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget | null;
    queryByDisplayValue: (value: Matcher, options?: MatcherOptions) => Gtk.Widget | null;
    queryAllByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Gtk.Widget[];
    queryAllByLabelText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    queryAllByText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    queryAllByName: (name: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    queryAllByPlaceholderText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    queryAllByDisplayValue: (value: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    getByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Gtk.Widget;
    getByLabelText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget;
    getByText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget;
    getByName: (name: Matcher, options?: MatcherOptions) => Gtk.Widget;
    getByPlaceholderText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget;
    getByDisplayValue: (value: Matcher, options?: MatcherOptions) => Gtk.Widget;
    getAllByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Gtk.Widget[];
    getAllByLabelText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    getAllByText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    getAllByName: (name: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    getAllByPlaceholderText: (text: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    getAllByDisplayValue: (value: Matcher, options?: MatcherOptions) => Gtk.Widget[];
    findByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Promise<Gtk.Widget>;
    findByLabelText: (text: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget>;
    findByText: (text: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget>;
    findByName: (name: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget>;
    findByPlaceholderText: (text: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget>;
    findByDisplayValue: (value: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget>;
    findAllByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Promise<Gtk.Widget[]>;
    findAllByLabelText: (text: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget[]>;
    findAllByText: (text: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget[]>;
    findAllByName: (name: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget[]>;
    findAllByPlaceholderText: (text: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget[]>;
    findAllByDisplayValue: (value: Matcher, options?: MatcherOptions) => Promise<Gtk.Widget[]>;
};

export type RenderResult<Q extends QueryMap = Record<never, never>> = BoundQueries &
    BoundCustomQueries<Q> & {
        container: Gtk.Widget;
        baseElement: Container;
        unmount: () => Promise<void>;
        rerender: (element: ReactNode) => Promise<void>;
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
