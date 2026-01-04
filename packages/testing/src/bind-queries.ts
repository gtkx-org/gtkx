import type * as Gtk from "@gtkx/ffi/gtk";
import * as queries from "./queries.js";
import type { Container } from "./traversal.js";
import type { BoundQueries, ByRoleOptions, TextMatch, TextMatchOptions } from "./types.js";

type ContainerOrGetter = Container | (() => Container);

const resolveContainer = (containerOrGetter: ContainerOrGetter): Container =>
    typeof containerOrGetter === "function" ? containerOrGetter() : containerOrGetter;

/**
 * Binds all query functions to a container.
 *
 * @param containerOrGetter - The container to bind queries to, or a function that returns it
 * @returns Object with all query methods bound to the container
 *
 * @internal
 */
export const bindQueries = (containerOrGetter: ContainerOrGetter): BoundQueries => ({
    queryByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) =>
        queries.queryByRole(resolveContainer(containerOrGetter), role, options),
    queryByLabelText: (text: TextMatch, options?: TextMatchOptions) =>
        queries.queryByLabelText(resolveContainer(containerOrGetter), text, options),
    queryByText: (text: TextMatch, options?: TextMatchOptions) =>
        queries.queryByText(resolveContainer(containerOrGetter), text, options),
    queryByTestId: (testId: TextMatch, options?: TextMatchOptions) =>
        queries.queryByTestId(resolveContainer(containerOrGetter), testId, options),
    queryAllByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) =>
        queries.queryAllByRole(resolveContainer(containerOrGetter), role, options),
    queryAllByLabelText: (text: TextMatch, options?: TextMatchOptions) =>
        queries.queryAllByLabelText(resolveContainer(containerOrGetter), text, options),
    queryAllByText: (text: TextMatch, options?: TextMatchOptions) =>
        queries.queryAllByText(resolveContainer(containerOrGetter), text, options),
    queryAllByTestId: (testId: TextMatch, options?: TextMatchOptions) =>
        queries.queryAllByTestId(resolveContainer(containerOrGetter), testId, options),
    findByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) =>
        queries.findByRole(resolveContainer(containerOrGetter), role, options),
    findByLabelText: (text: TextMatch, options?: TextMatchOptions) =>
        queries.findByLabelText(resolveContainer(containerOrGetter), text, options),
    findByText: (text: TextMatch, options?: TextMatchOptions) =>
        queries.findByText(resolveContainer(containerOrGetter), text, options),
    findByTestId: (testId: TextMatch, options?: TextMatchOptions) =>
        queries.findByTestId(resolveContainer(containerOrGetter), testId, options),
    findAllByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) =>
        queries.findAllByRole(resolveContainer(containerOrGetter), role, options),
    findAllByLabelText: (text: TextMatch, options?: TextMatchOptions) =>
        queries.findAllByLabelText(resolveContainer(containerOrGetter), text, options),
    findAllByText: (text: TextMatch, options?: TextMatchOptions) =>
        queries.findAllByText(resolveContainer(containerOrGetter), text, options),
    findAllByTestId: (testId: TextMatch, options?: TextMatchOptions) =>
        queries.findAllByTestId(resolveContainer(containerOrGetter), testId, options),
});
