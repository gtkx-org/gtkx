import type * as Gtk from "@gtkx/gi/gtk";
import { getConfig } from "./config.js";
import { runWithExpensiveErrorDiagnosticsDisabled, suggestionError } from "./errors.js";
import { getSuggestedQuery, type Method, type Variant } from "./suggestions.js";
import type { Container } from "./traversal.js";
import type { MatcherOptions, WaitForOptions } from "./types.js";
import { waitFor } from "./wait-for.js";

export type QueryAllBy<Args extends unknown[]> = (container: Container, ...args: Args) => Gtk.Widget[];

type MultipleErrorBuilder<Args extends unknown[]> = (
    container: Container,
    matches: Gtk.Widget[],
    ...args: Args
) => Error;
type MissingErrorBuilder<Args extends unknown[]> = (container: Container, ...args: Args) => Error;

export type BuiltQueries<Args extends unknown[]> = {
    queryBy: (container: Container, ...args: Args) => Gtk.Widget | null;
    getAllBy: QueryAllBy<Args>;
    getBy: (container: Container, ...args: Args) => Gtk.Widget;
    findAllBy: (container: Container, ...args: Args) => Promise<Gtk.Widget[]>;
    findBy: (container: Container, ...args: Args) => Promise<Gtk.Widget>;
};

const extractWaitForOptions = (args: unknown[]): WaitForOptions => {
    const last = args[args.length - 1];
    if (last && typeof last === "object" && !(last instanceof RegExp)) {
        const { timeout, interval, onTimeout } = last as WaitForOptions;
        return { timeout, interval, onTimeout };
    }
    return {};
};

const extractSuggestOption = (args: unknown[]): boolean | undefined => {
    const last = args[args.length - 1];
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
    if (!shouldSuggest) return;

    const suggestion = getSuggestedQuery(match, variant);
    if (suggestion && suggestion.queryName !== queryName) {
        throw suggestionError(suggestion.toString(), container);
    }
};

type FindQuery<Args extends unknown[]> = (container: Container, ...args: Args) => unknown;

const reRunForDiagnostics = <Args extends unknown[]>(
    query: FindQuery<Args>,
    container: Container,
    args: Args,
    fallback: Error,
): Error => {
    try {
        query(container, ...args);
    } catch (error) {
        if (error instanceof Error) return error;
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

const buildSyncQueries = <Args extends unknown[]>(deps: {
    queryName: Method;
    queryAllBy: QueryAllBy<Args>;
    getMultipleError: MultipleErrorBuilder<Args>;
    getMissingError: MissingErrorBuilder<Args>;
}) => {
    const { queryName, queryAllBy, getMultipleError, getMissingError } = deps;
    const suggest = (match: Gtk.Widget, variant: Variant, container: Container, args: Args): void =>
        maybeThrowSuggestion({ container, match, queryName, variant, suggest: extractSuggestOption(args) });

    const queryBy = (container: Container, ...args: Args): Gtk.Widget | null => {
        const matches = queryAllBy(container, ...args);
        if (matches.length > 1) throw getMultipleError(container, matches, ...args);
        const match = matches[0] ?? null;
        if (match) suggest(match, "query", container, args);
        return match;
    };

    const getAllBy = (container: Container, ...args: Args): Gtk.Widget[] => {
        const matches = queryAllBy(container, ...args);
        if (matches.length === 0) throw getMissingError(container, ...args);
        const [first] = matches;
        if (first !== undefined) suggest(first, "getAll", container, args);
        return matches;
    };

    const getBy = (container: Container, ...args: Args): Gtk.Widget => {
        const matches = queryAllBy(container, ...args);
        if (matches.length > 1) throw getMultipleError(container, matches, ...args);
        const [first] = matches;
        if (first === undefined) throw getMissingError(container, ...args);
        suggest(first, "get", container, args);
        return first;
    };

    return { queryBy, getAllBy, getBy };
};

export const buildQueries = <Args extends unknown[]>(
    queryName: Method,
    queryAllBy: QueryAllBy<Args>,
    getMultipleError: MultipleErrorBuilder<Args>,
    getMissingError: MissingErrorBuilder<Args>,
): BuiltQueries<Args> => {
    const { queryBy, getAllBy, getBy } = buildSyncQueries({ queryName, queryAllBy, getMultipleError, getMissingError });

    const findAllBy = (container: Container, ...args: Args): Promise<Gtk.Widget[]> =>
        waitFor(
            () => runWithExpensiveErrorDiagnosticsDisabled(() => getAllBy(container, ...args)),
            findOptions(getAllBy, container, args),
        );

    const findBy = (container: Container, ...args: Args): Promise<Gtk.Widget> =>
        waitFor(
            () => runWithExpensiveErrorDiagnosticsDisabled(() => getBy(container, ...args)),
            findOptions(getBy, container, args),
        );

    return { queryBy, getAllBy, getBy, findAllBy, findBy };
};
