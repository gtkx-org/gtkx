import type * as Gtk from "@gtkx/ffi/gtk";
import * as queries from "./queries.js";
import type { ByRoleOptions, TextMatch, TextMatchOptions } from "./types.js";

let currentRoot: Gtk.Application | null = null;

export const setScreenRoot = (root: Gtk.Application | null): void => {
    currentRoot = root;
};

const getRoot = (): Gtk.Application => {
    if (!currentRoot) {
        throw new Error("No render has been performed: call render() before using screen queries");
    }

    return currentRoot;
};

export const screen = {
    findByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) => queries.findByRole(getRoot(), role, options),
    findByLabelText: (text: TextMatch, options?: TextMatchOptions) => queries.findByLabelText(getRoot(), text, options),
    findByText: (text: TextMatch, options?: TextMatchOptions) => queries.findByText(getRoot(), text, options),
    findByTestId: (testId: TextMatch, options?: TextMatchOptions) => queries.findByTestId(getRoot(), testId, options),

    findAllByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) =>
        queries.findAllByRole(getRoot(), role, options),
    findAllByLabelText: (text: TextMatch, options?: TextMatchOptions) =>
        queries.findAllByLabelText(getRoot(), text, options),
    findAllByText: (text: TextMatch, options?: TextMatchOptions) => queries.findAllByText(getRoot(), text, options),
    findAllByTestId: (testId: TextMatch, options?: TextMatchOptions) =>
        queries.findAllByTestId(getRoot(), testId, options),

    debug: () => {
        console.log("Screen debug - root:", getRoot());
    },
};
