import type * as Gtk from "@gtkx/gi/gtk";
import type { Container } from "./traversal.js";
import type { WaitForOptions } from "./types.js";
import { waitFor } from "./wait-for.js";

/**
 * A query that returns every widget matching a search predicate.
 */
export type QueryAllBy<Args extends unknown[]> = (container: Container, ...args: Args) => Gtk.Widget[];

type MultipleErrorBuilder<Args extends unknown[]> = (container: Container, count: number, ...args: Args) => Error;
type MissingErrorBuilder<Args extends unknown[]> = (container: Container, ...args: Args) => Error;

/**
 * The five derived variants every search predicate expands into.
 */
export type BuiltQueries<Args extends unknown[]> = {
    queryBy: (container: Container, ...args: Args) => Gtk.Widget | null;
    getAllBy: QueryAllBy<Args>;
    getBy: (container: Container, ...args: Args) => Gtk.Widget;
    findAllBy: (container: Container, ...args: Args) => Promise<Gtk.Widget[]>;
    findBy: (container: Container, ...args: Args) => Promise<Gtk.Widget>;
};

const extractWaitForOptions = (args: readonly unknown[]): WaitForOptions => {
    const last = args[args.length - 1];
    if (last && typeof last === "object" && !(last instanceof RegExp)) {
        const { timeout, interval, onTimeout } = last as WaitForOptions;
        return { timeout, interval, onTimeout };
    }
    return {};
};

/**
 * Expands a single `queryAllBy*` predicate into the five query-variant family
 * (`queryBy*`, `getAllBy*`, `getBy*`, `findAllBy*`, `findBy*`).
 *
 * Mirrors the `buildQueries` helper from `@testing-library/dom`.
 *
 * @param queryAllBy - The search predicate that returns every matching widget.
 * @param getMultipleError - Builds the error thrown when more than one widget matches.
 * @param getMissingError - Builds the error thrown when no widgets match.
 */
export const buildQueries = <Args extends unknown[]>(
    queryAllBy: QueryAllBy<Args>,
    getMultipleError: MultipleErrorBuilder<Args>,
    getMissingError: MissingErrorBuilder<Args>,
): BuiltQueries<Args> => {
    const queryBy = (container: Container, ...args: Args): Gtk.Widget | null => {
        const matches = queryAllBy(container, ...args);
        if (matches.length > 1) {
            throw getMultipleError(container, matches.length, ...args);
        }
        return matches[0] ?? null;
    };

    const getAllBy = (container: Container, ...args: Args): Gtk.Widget[] => {
        const matches = queryAllBy(container, ...args);
        if (matches.length === 0) {
            throw getMissingError(container, ...args);
        }
        return matches;
    };

    const getBy = (container: Container, ...args: Args): Gtk.Widget => {
        const matches = getAllBy(container, ...args);
        if (matches.length > 1) {
            throw getMultipleError(container, matches.length, ...args);
        }
        const [first] = matches;
        if (first === undefined) {
            throw getMissingError(container, ...args);
        }
        return first;
    };

    const findAllBy = (container: Container, ...args: Args): Promise<Gtk.Widget[]> =>
        waitFor(() => getAllBy(container, ...args), extractWaitForOptions(args));

    const findBy = (container: Container, ...args: Args): Promise<Gtk.Widget> =>
        waitFor(() => getBy(container, ...args), extractWaitForOptions(args));

    return { queryBy, getAllBy, getBy, findAllBy, findBy };
};
