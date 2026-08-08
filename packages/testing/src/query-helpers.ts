import type * as Gtk from "@gtkx/gi/gtk";
import { camelCase } from "@gtkx/utils";
import type { Matcher, MatcherOptions } from "./types.js";
import { buildQueries } from "./build-queries.js";
import { getElementError } from "./errors.js";
import { isMatchingWidgetType, isTextMatch } from "./queries.js";
import { type Container, findAll } from "./traversal.js";

/** The helpers used to build custom queries, bundled the way DOM Testing Library exposes them. */
type QueryHelpers = {
    /** Derives a query family's variants from its `queryAllBy` function. */
    buildQueries: typeof buildQueries;
    /** Builds the error a failing query throws. */
    getElementError: typeof getElementError;
    /** Finds every widget whose GObject property matches. */
    queryAllByObjectProperty: typeof queryAllByObjectProperty;
    /** Finds the single widget whose GObject property matches. */
    queryByObjectProperty: typeof queryByObjectProperty;
};

/** The query-building helpers, bundled so they can be reached under a single import. */
const queryHelpers: QueryHelpers = {
    buildQueries,
    getElementError,
    queryAllByObjectProperty,
    queryByObjectProperty,
};

const readObjectProperty = (widget: Gtk.Widget, property: string): string | null => {
    const value: unknown = Reflect.get(widget, camelCase(property));

    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
        return String(value);
    }

    return null;
};

/**
 * Finds every widget carrying a GObject property whose value matches, the counterpart of DOM Testing
 * Library's `queryAllByAttribute`. The property name may be given in kebab-case or camelCase, and
 * widgets that are not mapped are never matched.
 *
 * @param property Name of the GObject property to read.
 * @param container Widget subtree to search.
 * @param text Matcher for the property's value.
 * @param options Text matching options.
 * @returns Every matching widget, or an empty array when none match.
 */
function queryAllByObjectProperty(
    property: string,
    container: Container,
    text: Matcher,
    options?: MatcherOptions,
): Gtk.Widget[] {
    return findAll(
        container,
        (widget) =>
            isMatchingWidgetType(widget, options) &&
            isTextMatch(readObjectProperty(widget, property), text, widget, options),
    );
}

/**
 * Returns the single widget carrying a GObject property whose value matches, or null when none do,
 * the counterpart of DOM Testing Library's `queryByAttribute`.
 *
 * @param property Name of the GObject property to read.
 * @param container Widget subtree to search.
 * @param text Matcher for the property's value.
 * @param options Text matching options.
 * @returns The matching widget, or null when none match.
 * @throws When more than one widget matches.
 */
function queryByObjectProperty(
    property: string,
    container: Container,
    text: Matcher,
    options?: MatcherOptions,
): Gtk.Widget | null {
    const matches = queryAllByObjectProperty(property, container, text, options);

    if (matches.length > 1) {
        throw getElementError(
            `Found ${String(matches.length)} elements with the '${property}' property, but expected only one`,
            container,
        );
    }

    return matches[0] ?? null;
}

export { queryAllByObjectProperty, queryByObjectProperty, queryHelpers, type QueryHelpers };
