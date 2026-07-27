import type * as Gtk from "@gtkx/gi/gtk";
import type { Container } from "./traversal.js";
import type { MatcherOptions, WaitForOptions } from "./types.js";
import { getConfig } from "./config.js";
import { runWithExpensiveErrorDiagnosticsDisabled, suggestionError } from "./errors.js";
import { getSuggestedQuery, type Method, type Variant } from "./suggestions.js";
import { waitFor } from "./wait-for.js";

type QueryAllBy<Args extends unknown[]> = (container: Container, ...args: Args) => Gtk.Widget[];

type MultipleErrorBuilder<Args extends unknown[]> = (
    container: Container,
    matches: Gtk.Widget[],
    ...args: Args
) => Error;

type MissingErrorBuilder<Args extends unknown[]> = (container: Container, ...args: Args) => Error;

type BuiltQueries<Args extends unknown[]> = {
    queryBy: (container: Container, ...args: Args) => Gtk.Widget | null;
    getAllBy: QueryAllBy<Args>;
    getBy: (container: Container, ...args: Args) => Gtk.Widget;
    findAllBy: (container: Container, ...args: Args) => Promise<Gtk.Widget[]>;
    findBy: (container: Container, ...args: Args) => Promise<Gtk.Widget>;
};

type FindQuery<Args extends unknown[]> = (container: Container, ...args: Args) => unknown;
type SingleQuery<Args extends unknown[]> = (container: Container, ...args: Args) => Gtk.Widget | null;

const extractWaitForOptions = (args: unknown[]): WaitForOptions => {
    const last = args.at(-1);

    if (last && typeof last === "object" && !(last instanceof RegExp)) {
        const { timeout, interval, onTimeout } = last as WaitForOptions;

        return { timeout, interval, onTimeout };
    }

    return {};
};

const extractSuggestOption = (args: unknown[]): boolean | undefined => {
    const last = args.at(-1);

    if (last && typeof last === "object" && !(last instanceof RegExp)) {
        return (last as MatcherOptions).suggest;
    }

    return undefined;
};

const maybeThrowSuggestion = (options: {
    container: Container;
    match: Gtk.Widget;
    queryName: Method;
    variant: Variant;
    suggest: boolean | undefined;
}): void => {
    const { container, match, queryName, variant, suggest } = options;
    const shouldSuggest = suggest ?? getConfig().throwSuggestions;

    if (!shouldSuggest) {
        return;
    }

    const suggestion = getSuggestedQuery(match, variant);

    if (suggestion && suggestion.queryName !== queryName) {
        throw suggestionError(suggestion.toString(), container);
    }
};

const reRunForDiagnostics = <Args extends unknown[]>(
    query: FindQuery<Args>,
    container: Container,
    args: Args,
    fallback: Error,
): Error => {
    try {
        query(container, ...args);
    } catch (error) {
        if (error instanceof Error) {
            return error;
        }
    }

    return fallback;
};

const findOptions = <Args extends unknown[]>(
    query: FindQuery<Args>,
    container: Container,
    args: Args,
): WaitForOptions => {
    const userOptions = extractWaitForOptions(args);

    const onTimeout =
        userOptions.onTimeout ?? ((fallback: Error) => reRunForDiagnostics(query, container, args, fallback));

    return {
        stackTraceError: new Error("STACK_TRACE_MESSAGE"),
        onTimeout,
        timeout: userOptions.timeout,
        interval: userOptions.interval,
    };
};

const singleFrom =
    <Args extends unknown[]>(
        allQuery: QueryAllBy<Args>,
        getMultipleError: MultipleErrorBuilder<Args>,
    ): SingleQuery<Args> =>
        (container, ...args) => {
            const matches = allQuery(container, ...args);

            if (matches.length > 1) {
                throw getMultipleError(container, matches, ...args);
            }

            return matches[0] ?? null;
        };

const allOrThrow =
    <Args extends unknown[]>(
        allQuery: QueryAllBy<Args>,
        getMissingError: MissingErrorBuilder<Args>,
    ): QueryAllBy<Args> =>
        (container, ...args) => {
            const matches = allQuery(container, ...args);

            if (matches.length === 0) {
                throw getMissingError(container, ...args);
            }

            return matches;
        };

const wrapSingleWithSuggestion =
    <Args extends unknown[]>(query: SingleQuery<Args>, queryName: Method, variant: Variant): SingleQuery<Args> =>
        (container, ...args) => {
            const match = query(container, ...args);

            if (match) {
                maybeThrowSuggestion({ container, match, queryName, variant, suggest: extractSuggestOption(args) });
            }

            return match;
        };

const wrapAllWithSuggestion =
    <Args extends unknown[]>(query: QueryAllBy<Args>, queryName: Method, variant: Variant): QueryAllBy<Args> =>
        (container, ...args) => {
            const matches = query(container, ...args);
            const [first] = matches;

            if (first !== undefined) {
                maybeThrowSuggestion({
                    container,
                    match: first,
                    queryName,
                    variant,
                    suggest: extractSuggestOption(args),
                });
            }

            return matches;
        };

const requireSingle =
    <Args extends unknown[]>(query: SingleQuery<Args>, getMissingError: MissingErrorBuilder<Args>) =>
        (container: Container, ...args: Args): Gtk.Widget => {
            const match = query(container, ...args);

            if (match === null) {
                throw getMissingError(container, ...args);
            }

            return match;
        };

const buildQueries = <Args extends unknown[]>(
    queryName: Method,
    queryAllBy: QueryAllBy<Args>,
    getMultipleError: MultipleErrorBuilder<Args>,
    getMissingError: MissingErrorBuilder<Args>,
): BuiltQueries<Args> => {
    const getAllBy = allOrThrow(queryAllBy, getMissingError);
    const getBy = requireSingle(singleFrom(getAllBy, getMultipleError), getMissingError);

    const queryByWithSuggestion = wrapSingleWithSuggestion(
        singleFrom(queryAllBy, getMultipleError),
        queryName,
        "query",
    );

    const getAllByWithSuggestion = wrapAllWithSuggestion(getAllBy, queryName, "getAll");

    const getByWithSuggestion: (container: Container, ...args: Args) => Gtk.Widget = (container, ...args) => {
        const match = getBy(container, ...args);
        maybeThrowSuggestion({ container, match, queryName, variant: "get", suggest: extractSuggestOption(args) });

        return match;
    };

    const findAllBy = (container: Container, ...args: Args): Promise<Gtk.Widget[]> =>
        waitFor(
            () => runWithExpensiveErrorDiagnosticsDisabled(() => getAllByWithSuggestion(container, ...args)),
            findOptions(getAllByWithSuggestion, container, args),
        );

    const findBy = (container: Container, ...args: Args): Promise<Gtk.Widget> =>
        waitFor(
            () => runWithExpensiveErrorDiagnosticsDisabled(() => getByWithSuggestion(container, ...args)),
            findOptions(getByWithSuggestion, container, args),
        );

    return {
        queryBy: queryByWithSuggestion,
        getAllBy: getAllByWithSuggestion,
        getBy: getByWithSuggestion,
        findAllBy,
        findBy,
    };
};

export { buildQueries, type QueryAllBy, type BuiltQueries };
