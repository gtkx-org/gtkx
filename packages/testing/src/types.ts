import type * as Gtk from "@gtkx/ffi/gtk";
import type { ComponentType, ReactNode } from "react";

export type TextMatchFunction = (content: string, widget: Gtk.Widget) => boolean;

export type TextMatch = string | RegExp | TextMatchFunction;

export type NormalizerOptions = {

    trim?: boolean;

    collapseWhitespace?: boolean;
};

export type TextMatchOptions = {

    exact?: boolean;

    normalizer?: (text: string) => string;

    trim?: boolean;

    collapseWhitespace?: boolean;

    timeout?: number;
};

export type ByRoleOptions = TextMatchOptions & {

    name?: TextMatch;

    checked?: boolean;

    pressed?: boolean;

    selected?: boolean;

    expanded?: boolean;

    level?: number;
};

export type WaitForOptions = {

    timeout?: number;

    interval?: number;

    onTimeout?: (error: Error) => Error;
};

export type RenderOptions = {

    wrapper?: boolean | ComponentType<{ children: ReactNode }>;
};

export type BoundQueries = {

    findByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Promise<Gtk.Widget>;

    findByLabelText: (text: TextMatch, options?: TextMatchOptions) => Promise<Gtk.Widget>;

    findByText: (text: TextMatch, options?: TextMatchOptions) => Promise<Gtk.Widget>;

    findByTestId: (testId: TextMatch, options?: TextMatchOptions) => Promise<Gtk.Widget>;

    findAllByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => Promise<Gtk.Widget[]>;

    findAllByLabelText: (text: TextMatch, options?: TextMatchOptions) => Promise<Gtk.Widget[]>;

    findAllByText: (text: TextMatch, options?: TextMatchOptions) => Promise<Gtk.Widget[]>;

    findAllByTestId: (testId: TextMatch, options?: TextMatchOptions) => Promise<Gtk.Widget[]>;
};

export type RenderResult = BoundQueries & {

    container: Gtk.Application;

    unmount: () => Promise<void>;

    rerender: (element: ReactNode) => Promise<void>;

    debug: () => void;
};
