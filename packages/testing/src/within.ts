import type { BoundQueries } from "./bound-queries.js";
import { builtinQueries } from "./queries.js";
import type { Container } from "./traversal.js";
import type { BoundCustomQueries, QueryMap } from "./types.js";

const bindQuery =
    <Args extends unknown[], Result>(query: (container: Container, ...args: Args) => Result, container: Container) =>
    (...args: Args): Result =>
        query(container, ...args);

const bindCustomQueries = <Q extends QueryMap>(customQueries: Q, container: Container): BoundCustomQueries<Q> => {
    const entries = Object.entries(customQueries).map(([key, query]) => [key, bindQuery(query, container)] as const);
    return Object.fromEntries(entries) as BoundCustomQueries<Q>;
};

export const within = <Q extends QueryMap = Record<never, never>>(
    container: Container,
    queries?: Q,
): BoundQueries & BoundCustomQueries<Q> => ({
    ...bindCustomQueries(builtinQueries, container),
    ...(queries ? bindCustomQueries(queries, container) : ({} as BoundCustomQueries<Q>)),
});
