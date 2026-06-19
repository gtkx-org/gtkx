import * as queries from "./queries.js";
import type { Container } from "./traversal.js";
import type { BoundCustomQueries, BoundQueries, QueryMap } from "./types.js";

type ContainerOrGetter = Container | (() => Container);

const resolveContainer = (containerOrGetter: ContainerOrGetter): Container =>
    typeof containerOrGetter === "function" ? containerOrGetter() : containerOrGetter;

const bindQuery =
    <Args extends unknown[], Result>(
        query: (container: Container, ...args: Args) => Result,
        containerOrGetter: ContainerOrGetter,
    ) =>
    (...args: Args): Result =>
        query(resolveContainer(containerOrGetter), ...args);

const bindCustomQueries = <Q extends QueryMap>(
    customQueries: Q,
    containerOrGetter: ContainerOrGetter,
): BoundCustomQueries<Q> => {
    const entries = Object.entries(customQueries).map(
        ([key, query]) => [key, bindQuery(query, containerOrGetter)] as const,
    );
    return Object.fromEntries(entries) as BoundCustomQueries<Q>;
};

/**
 * Binds all query functions to a container.
 *
 * @param containerOrGetter - The container to bind queries to, or a function that returns it
 * @param customQueries - Extra query functions to bind alongside the built-ins
 * @returns Object with all query methods bound to the container
 */
export const bindQueries = <Q extends QueryMap = Record<never, never>>(
    containerOrGetter: ContainerOrGetter,
    customQueries?: Q,
): BoundQueries & BoundCustomQueries<Q> => ({
    queryByRole: bindQuery(queries.queryByRole, containerOrGetter),
    queryByLabelText: bindQuery(queries.queryByLabelText, containerOrGetter),
    queryByText: bindQuery(queries.queryByText, containerOrGetter),
    queryByName: bindQuery(queries.queryByName, containerOrGetter),
    queryByPlaceholderText: bindQuery(queries.queryByPlaceholderText, containerOrGetter),
    queryByDisplayValue: bindQuery(queries.queryByDisplayValue, containerOrGetter),
    queryAllByRole: bindQuery(queries.queryAllByRole, containerOrGetter),
    queryAllByLabelText: bindQuery(queries.queryAllByLabelText, containerOrGetter),
    queryAllByText: bindQuery(queries.queryAllByText, containerOrGetter),
    queryAllByName: bindQuery(queries.queryAllByName, containerOrGetter),
    queryAllByPlaceholderText: bindQuery(queries.queryAllByPlaceholderText, containerOrGetter),
    queryAllByDisplayValue: bindQuery(queries.queryAllByDisplayValue, containerOrGetter),
    getByRole: bindQuery(queries.getByRole, containerOrGetter),
    getByLabelText: bindQuery(queries.getByLabelText, containerOrGetter),
    getByText: bindQuery(queries.getByText, containerOrGetter),
    getByName: bindQuery(queries.getByName, containerOrGetter),
    getByPlaceholderText: bindQuery(queries.getByPlaceholderText, containerOrGetter),
    getByDisplayValue: bindQuery(queries.getByDisplayValue, containerOrGetter),
    getAllByRole: bindQuery(queries.getAllByRole, containerOrGetter),
    getAllByLabelText: bindQuery(queries.getAllByLabelText, containerOrGetter),
    getAllByText: bindQuery(queries.getAllByText, containerOrGetter),
    getAllByName: bindQuery(queries.getAllByName, containerOrGetter),
    getAllByPlaceholderText: bindQuery(queries.getAllByPlaceholderText, containerOrGetter),
    getAllByDisplayValue: bindQuery(queries.getAllByDisplayValue, containerOrGetter),
    findByRole: bindQuery(queries.findByRole, containerOrGetter),
    findByLabelText: bindQuery(queries.findByLabelText, containerOrGetter),
    findByText: bindQuery(queries.findByText, containerOrGetter),
    findByName: bindQuery(queries.findByName, containerOrGetter),
    findByPlaceholderText: bindQuery(queries.findByPlaceholderText, containerOrGetter),
    findByDisplayValue: bindQuery(queries.findByDisplayValue, containerOrGetter),
    findAllByRole: bindQuery(queries.findAllByRole, containerOrGetter),
    findAllByLabelText: bindQuery(queries.findAllByLabelText, containerOrGetter),
    findAllByText: bindQuery(queries.findAllByText, containerOrGetter),
    findAllByName: bindQuery(queries.findAllByName, containerOrGetter),
    findAllByPlaceholderText: bindQuery(queries.findAllByPlaceholderText, containerOrGetter),
    findAllByDisplayValue: bindQuery(queries.findAllByDisplayValue, containerOrGetter),
    ...(customQueries ? bindCustomQueries(customQueries, containerOrGetter) : ({} as BoundCustomQueries<Q>)),
});
