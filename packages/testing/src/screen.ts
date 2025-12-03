import type * as Gtk from "@gtkx/ffi/gtk";
import type { AccessibleRole } from "@gtkx/ffi/gtk";
import * as queries from "./queries.js";
import type { ByRoleOptions, TextMatchOptions } from "./types.js";

let currentRoot: Gtk.Application | null = null;

/**
 * Sets the root application for screen queries. Called internally by render().
 * @param root - The GTK application to use as query root, or null to clear
 */
export const setScreenRoot = (root: Gtk.Application | null): void => {
    currentRoot = root;
};

const getRoot = (): Gtk.Application => {
    if (!currentRoot) {
        throw new Error("No render has been performed. Call render() before using screen queries.");
    }
    return currentRoot;
};

/**
 * Global screen object providing query methods bound to the current render root.
 * Similar to Testing Library's screen, it provides all query variants without
 * needing to destructure from render().
 */
export const screen = {
    getByRole: (role: AccessibleRole, options?: ByRoleOptions) => queries.getByRole(getRoot(), role, options),
    getByLabelText: (text: string | RegExp, options?: TextMatchOptions) =>
        queries.getByLabelText(getRoot(), text, options),
    getByText: (text: string | RegExp, options?: TextMatchOptions) => queries.getByText(getRoot(), text, options),
    getByTestId: (testId: string | RegExp, options?: TextMatchOptions) =>
        queries.getByTestId(getRoot(), testId, options),

    queryByRole: (role: AccessibleRole, options?: ByRoleOptions) => queries.queryByRole(getRoot(), role, options),
    queryByLabelText: (text: string | RegExp, options?: TextMatchOptions) =>
        queries.queryByLabelText(getRoot(), text, options),
    queryByText: (text: string | RegExp, options?: TextMatchOptions) => queries.queryByText(getRoot(), text, options),
    queryByTestId: (testId: string | RegExp, options?: TextMatchOptions) =>
        queries.queryByTestId(getRoot(), testId, options),

    getAllByRole: (role: AccessibleRole, options?: ByRoleOptions) => queries.getAllByRole(getRoot(), role, options),
    getAllByLabelText: (text: string | RegExp, options?: TextMatchOptions) =>
        queries.getAllByLabelText(getRoot(), text, options),
    getAllByText: (text: string | RegExp, options?: TextMatchOptions) => queries.getAllByText(getRoot(), text, options),
    getAllByTestId: (testId: string | RegExp, options?: TextMatchOptions) =>
        queries.getAllByTestId(getRoot(), testId, options),

    queryAllByRole: (role: AccessibleRole, options?: ByRoleOptions) => queries.queryAllByRole(getRoot(), role, options),
    queryAllByLabelText: (text: string | RegExp, options?: TextMatchOptions) =>
        queries.queryAllByLabelText(getRoot(), text, options),
    queryAllByText: (text: string | RegExp, options?: TextMatchOptions) =>
        queries.queryAllByText(getRoot(), text, options),
    queryAllByTestId: (testId: string | RegExp, options?: TextMatchOptions) =>
        queries.queryAllByTestId(getRoot(), testId, options),

    findByRole: (role: AccessibleRole, options?: ByRoleOptions) => queries.findByRole(getRoot(), role, options),
    findByLabelText: (text: string | RegExp, options?: TextMatchOptions) =>
        queries.findByLabelText(getRoot(), text, options),
    findByText: (text: string | RegExp, options?: TextMatchOptions) => queries.findByText(getRoot(), text, options),
    findByTestId: (testId: string | RegExp, options?: TextMatchOptions) =>
        queries.findByTestId(getRoot(), testId, options),

    findAllByRole: (role: AccessibleRole, options?: ByRoleOptions) => queries.findAllByRole(getRoot(), role, options),
    findAllByLabelText: (text: string | RegExp, options?: TextMatchOptions) =>
        queries.findAllByLabelText(getRoot(), text, options),
    findAllByText: (text: string | RegExp, options?: TextMatchOptions) =>
        queries.findAllByText(getRoot(), text, options),
    findAllByTestId: (testId: string | RegExp, options?: TextMatchOptions) =>
        queries.findAllByTestId(getRoot(), testId, options),

    debug: () => {
        console.log("Screen debug - root:", getRoot());
    },
};
