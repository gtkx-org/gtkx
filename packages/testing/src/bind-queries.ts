import type * as Gtk from "@gtkx/ffi/gtk";
import * as queries from "./queries.js";
import type { Container } from "./traversal.js";
import type { BoundQueries, ByRoleOptions, Matcher, MatcherOptions } from "./types.js";

type ContainerOrGetter = Container | (() => Container);

const resolveContainer = (containerOrGetter: ContainerOrGetter): Container =>
    typeof containerOrGetter === "function" ? containerOrGetter() : containerOrGetter;

/**
 * Binds all query functions to a container.
 *
 * @param containerOrGetter - The container to bind queries to, or a function that returns it
 * @returns Object with all query methods bound to the container
 */
export const bindQueries = (containerOrGetter: ContainerOrGetter): BoundQueries => ({
    queryByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) =>
        queries.queryByRole(resolveContainer(containerOrGetter), role, options),
    queryByLabelText: (text: Matcher, options?: MatcherOptions) =>
        queries.queryByLabelText(resolveContainer(containerOrGetter), text, options),
    queryByText: (text: Matcher, options?: MatcherOptions) =>
        queries.queryByText(resolveContainer(containerOrGetter), text, options),
    queryByName: (name: Matcher, options?: MatcherOptions) =>
        queries.queryByName(resolveContainer(containerOrGetter), name, options),
    queryAllByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) =>
        queries.queryAllByRole(resolveContainer(containerOrGetter), role, options),
    queryAllByLabelText: (text: Matcher, options?: MatcherOptions) =>
        queries.queryAllByLabelText(resolveContainer(containerOrGetter), text, options),
    queryAllByText: (text: Matcher, options?: MatcherOptions) =>
        queries.queryAllByText(resolveContainer(containerOrGetter), text, options),
    queryAllByName: (name: Matcher, options?: MatcherOptions) =>
        queries.queryAllByName(resolveContainer(containerOrGetter), name, options),
    getByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) =>
        queries.getByRole(resolveContainer(containerOrGetter), role, options),
    getByLabelText: (text: Matcher, options?: MatcherOptions) =>
        queries.getByLabelText(resolveContainer(containerOrGetter), text, options),
    getByText: (text: Matcher, options?: MatcherOptions) =>
        queries.getByText(resolveContainer(containerOrGetter), text, options),
    getByName: (name: Matcher, options?: MatcherOptions) =>
        queries.getByName(resolveContainer(containerOrGetter), name, options),
    getAllByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) =>
        queries.getAllByRole(resolveContainer(containerOrGetter), role, options),
    getAllByLabelText: (text: Matcher, options?: MatcherOptions) =>
        queries.getAllByLabelText(resolveContainer(containerOrGetter), text, options),
    getAllByText: (text: Matcher, options?: MatcherOptions) =>
        queries.getAllByText(resolveContainer(containerOrGetter), text, options),
    getAllByName: (name: Matcher, options?: MatcherOptions) =>
        queries.getAllByName(resolveContainer(containerOrGetter), name, options),
    findByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) =>
        queries.findByRole(resolveContainer(containerOrGetter), role, options),
    findByLabelText: (text: Matcher, options?: MatcherOptions) =>
        queries.findByLabelText(resolveContainer(containerOrGetter), text, options),
    findByText: (text: Matcher, options?: MatcherOptions) =>
        queries.findByText(resolveContainer(containerOrGetter), text, options),
    findByName: (name: Matcher, options?: MatcherOptions) =>
        queries.findByName(resolveContainer(containerOrGetter), name, options),
    findAllByRole: (role: Gtk.AccessibleRole, options?: ByRoleOptions) =>
        queries.findAllByRole(resolveContainer(containerOrGetter), role, options),
    findAllByLabelText: (text: Matcher, options?: MatcherOptions) =>
        queries.findAllByLabelText(resolveContainer(containerOrGetter), text, options),
    findAllByText: (text: Matcher, options?: MatcherOptions) =>
        queries.findAllByText(resolveContainer(containerOrGetter), text, options),
    findAllByName: (name: Matcher, options?: MatcherOptions) =>
        queries.findAllByName(resolveContainer(containerOrGetter), name, options),
});
