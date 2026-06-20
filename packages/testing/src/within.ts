import { bindQueries } from "./bind-queries.js";
import type { Container } from "./traversal.js";
import type { BoundCustomQueries, BoundQueries, QueryMap } from "./types.js";

export const within = <Q extends QueryMap = Record<never, never>>(
    container: Container,
    queries?: Q,
): BoundQueries & BoundCustomQueries<Q> => bindQueries(container, queries);
