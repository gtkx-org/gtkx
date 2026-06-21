import type * as Gtk from "@gtkx/gi/gtk";
import { getConfig } from "./config.js";
import { suggestionError } from "./errors.js";
import { getSuggestedQuery, type Method, type Variant } from "./suggestions.js";
import type { Container } from "./traversal.js";
import type { MatcherOptions, WaitForOptions } from "./types.js";
import { waitFor } from "./wait-for.js";

export type QueryAllBy<Args extends unknown[]> = (container: Container, ...args: Args) => Gtk.Widget[];

type MultipleErrorBuilder<Args extends unknown[]> = (container: Container, count: number, ...args: Args) => Error;
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

export const buildQueries = <Args extends unknown[]>(
    queryName: Method,
    queryAllBy: QueryAllBy<Args>,
    getMultipleError: MultipleErrorBuilder<Args>,
    getMissingError: MissingErrorBuilder<Args>,
): BuiltQueries<Args> => {
    const queryBy = (container: Container, ...args: Args): Gtk.Widget | null => {
        const matches = queryAllBy(container, ...args);
        if (matches.length > 1) {
            throw getMultipleError(container, matches.length, ...args);
        }
        const match = matches[0] ?? null;
        if (match) {
            maybeThrowSuggestion({
                container,
                match,
                queryName,
                variant: "query",
                suggest: extractSuggestOption(args),
            });
        }
        return match;
    };

    const getAllBy = (container: Container, ...args: Args): Gtk.Widget[] => {
        const matches = queryAllBy(container, ...args);
        if (matches.length === 0) {
            throw getMissingError(container, ...args);
        }
        const [first] = matches;
        if (first !== undefined) {
            maybeThrowSuggestion({
                container,
                match: first,
                queryName,
                variant: "getAll",
                suggest: extractSuggestOption(args),
            });
        }
        return matches;
    };

    const getBy = (container: Container, ...args: Args): Gtk.Widget => {
        const matches = queryAllBy(container, ...args);
        if (matches.length > 1) {
            throw getMultipleError(container, matches.length, ...args);
        }
        const [first] = matches;
        if (first === undefined) {
            throw getMissingError(container, ...args);
        }
        maybeThrowSuggestion({
            container,
            match: first,
            queryName,
            variant: "get",
            suggest: extractSuggestOption(args),
        });
        return first;
    };

    const findAllBy = (container: Container, ...args: Args): Promise<Gtk.Widget[]> =>
        waitFor(() => getAllBy(container, ...args), extractWaitForOptions(args));

    const findBy = (container: Container, ...args: Args): Promise<Gtk.Widget> =>
        waitFor(() => getBy(container, ...args), extractWaitForOptions(args));

    return { queryBy, getAllBy, getBy, findAllBy, findBy };
};
