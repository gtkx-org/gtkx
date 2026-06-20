import * as queries from "./queries.js";
import type { Container } from "./traversal.js";
import type { BoundCustomQueries, BoundQueries, Query, QueryMap } from "./types.js";

/** Matches the built-in query export names: `queryBy`/`getBy`/`findBy` and their `All` variants. */
const BUILTIN_QUERY_PATTERN = /^(query|get|find)(All)?By/;

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
): BoundQueries & BoundCustomQueries<Q> => {
    const builtins: Record<string, (...args: never[]) => unknown> = {};
    for (const [name, value] of Object.entries(queries)) {
        if (BUILTIN_QUERY_PATTERN.test(name) && typeof value === "function") {
            builtins[name] = bindQuery(value as Query, containerOrGetter);
        }
    }
    return {
        ...(builtins as BoundQueries),
        ...(customQueries ? bindCustomQueries(customQueries, containerOrGetter) : ({} as BoundCustomQueries<Q>)),
    };
};
