import * as queries from "./queries.js";
import type { Container } from "./traversal.js";
import type { BoundCustomQueries, BoundQueries, Query, QueryMap } from "./types.js";

const BUILTIN_QUERY_PATTERN = /^(query|get|find)(All)?By/;

const bindQuery =
    <Args extends unknown[], Result>(query: (container: Container, ...args: Args) => Result, container: Container) =>
    (...args: Args): Result =>
        query(container, ...args);

const bindCustomQueries = <Q extends QueryMap>(customQueries: Q, container: Container): BoundCustomQueries<Q> => {
    const entries = Object.entries(customQueries).map(([key, query]) => [key, bindQuery(query, container)] as const);
    return Object.fromEntries(entries) as BoundCustomQueries<Q>;
};

export const bindQueries = <Q extends QueryMap = Record<never, never>>(
    container: Container,
    customQueries?: Q,
): BoundQueries & BoundCustomQueries<Q> => {
    const builtins: Record<string, (...args: never[]) => unknown> = {};
    for (const [name, value] of Object.entries(queries)) {
        if (BUILTIN_QUERY_PATTERN.test(name) && typeof value === "function") {
            builtins[name] = bindQuery(value as Query, container);
        }
    }
    return {
        ...(builtins as BoundQueries),
        ...(customQueries ? bindCustomQueries(customQueries, container) : ({} as BoundCustomQueries<Q>)),
    };
};
