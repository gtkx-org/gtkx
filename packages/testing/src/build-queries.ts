import type * as Gtk from "@gtkx/gi/gtk";
import type { Container } from "./traversal.js";
import type { MatcherOptions, WaitForOptions } from "./types.js";
import { getConfig } from "./config.js";
import { runWithExpensiveErrorDiagnosticsDisabled, suggestionError } from "./errors.js";
import { getSuggestedQuery, type Variant } from "./suggestions.js";
import { waitFor } from "./wait-for.js";

/**
 * The `queryAllBy` function a query family is built from, taking the scope to search followed by the
 * family's own matcher arguments. Its name determines the family name, so `queryAllByTestId` builds
 * a `TestId` family.
 */
type QueryAllBy<Args extends unknown[]> = (container: Container, ...args: Args) => Gtk.Widget[];

/** Builds the error thrown when a single-match query finds more than one widget. */
type MultipleErrorBuilder<Args extends unknown[]> = (
    container: Container,
    matches: Gtk.Widget[],
    ...args: Args
) => Error;

/** Builds the error thrown when a query that requires a match finds none. */
type MissingErrorBuilder<Args extends unknown[]> = (container: Container, ...args: Args) => Error;

/** The variants derived from one `queryAllBy` function, in the order DOM Testing Library returns them. */
type BuiltQueries<Args extends unknown[]> = [
    queryBy: (container: Container, ...args: Args) => Gtk.Widget | null,
    getAllBy: QueryAllBy<Args>,
    getBy: (container: Container, ...args: Args) => Gtk.Widget,
    findAllBy: (container: Container, ...args: Args) => Promise<Gtk.Widget[]>,
    findBy: (container: Container, ...args: Args) => Promise<Gtk.Widget>,
];

type FindQuery<Args extends unknown[]> = (container: Container, ...args: Args) => unknown;
type SingleQuery<Args extends unknown[]> = (container: Container, ...args: Args) => Gtk.Widget | null;

const getTrailingOptions = (args: unknown[]): MatcherOptions | undefined => {
    const last = args.at(-1);

    if (last && typeof last === "object" && !(last instanceof RegExp)) {
        return last;
    }

    return undefined;
};

const extractShouldSuggest = (args: unknown[]): boolean | undefined => getTrailingOptions(args)?.suggest;
const getQueryFamily = (queryAllBy: { name: string }): string => queryAllBy.name.replace(/^queryAllBy/, "");

const maybeThrowSuggestion = (options: {
    container: Container;
    match: Gtk.Widget;
    queryName: string;
    variant: Variant;
    shouldSuggest: boolean | undefined;
}): void => {
    const { container, match, queryName, variant, shouldSuggest } = options;

    if (!(shouldSuggest ?? getConfig().throwSuggestions)) {
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
    const { timeout, interval, onTimeout } = getTrailingOptions(args) ?? {};

    return {
        stackTraceError: new Error("STACK_TRACE_MESSAGE"),
        onTimeout: onTimeout ?? ((fallback: Error) => reRunForDiagnostics(query, container, args, fallback)),
        timeout,
        interval,
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
    <Args extends unknown[]>(query: SingleQuery<Args>, queryName: string, variant: Variant): SingleQuery<Args> =>
        (container, ...args) => {
            const match = query(container, ...args);

            if (match) {
                maybeThrowSuggestion({
                    container,
                    match,
                    queryName,
                    variant,
                    shouldSuggest: extractShouldSuggest(args),
                });
            }

            return match;
        };

const wrapAllWithSuggestion =
    <Args extends unknown[]>(query: QueryAllBy<Args>, queryName: string, variant: Variant): QueryAllBy<Args> =>
        (container, ...args) => {
            const matches = query(container, ...args);
            const [first] = matches;

            if (first !== undefined) {
                maybeThrowSuggestion({
                    container,
                    match: first,
                    queryName,
                    variant,
                    shouldSuggest: extractShouldSuggest(args),
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

/**
 * Derives the `queryBy`, `getAllBy`, `getBy`, `findAllBy`, and `findBy` variants of a query family
 * from the family's `queryAllBy` function, mirroring DOM Testing Library's `buildQueries`. The family
 * name used when suggesting a better query comes from `queryAllBy.name`.
 *
 * @param queryAllBy Finds every widget the family matches.
 * @param getMultipleError Builds the error thrown when a single-match variant finds more than one widget.
 * @param getMissingError Builds the error thrown when a required match is missing.
 * @returns The five variants, in the order `[queryBy, getAllBy, getBy, findAllBy, findBy]`.
 */
const buildQueries = <Args extends unknown[]>(
    queryAllBy: QueryAllBy<Args>,
    getMultipleError: MultipleErrorBuilder<Args>,
    getMissingError: MissingErrorBuilder<Args>,
): BuiltQueries<Args> => {
    const queryName = getQueryFamily(queryAllBy);
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

        maybeThrowSuggestion({
            container,
            match,
            queryName,
            variant: "get",
            shouldSuggest: extractShouldSuggest(args),
        });

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

    return [queryByWithSuggestion, getAllByWithSuggestion, getByWithSuggestion, findAllBy, findBy];
};

export {
    buildQueries,
    type BuiltQueries,
    type MissingErrorBuilder,
    type MultipleErrorBuilder,
    type QueryAllBy,
};
