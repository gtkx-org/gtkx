import * as Gtk from "@gtkx/gi/gtk";
import { formatRole } from "./role-helpers.js";
import {
    getWidgetAccessibleName,
    getWidgetDisplayValue,
    getWidgetLabelledByText,
    getWidgetName,
    getWidgetOwnLabel,
    getWidgetPlaceholderText,
    getWidgetText,
} from "./widget-text.js";

/**
 * The query variant a {@link Suggestion} targets, mirroring the six query forms.
 */
export type Variant = "get" | "getAll" | "query" | "queryAll" | "find" | "findAll";

/**
 * The query axis a {@link Suggestion} recommends, ordered from most to least
 * preferred. `Name` is the GTK analog of Testing Library's least-preferred
 * `TestId`.
 */
export type Method = "Role" | "LabelText" | "PlaceholderText" | "Text" | "DisplayValue" | "Name";

/**
 * A recommended query for a widget, mirroring `@testing-library/dom`'s
 * `getSuggestedQuery` result.
 */
export type Suggestion = {
    /** The query axis (e.g. `"Role"`). */
    queryName: Method;
    /** The full query method name (e.g. `"getByRole"`). */
    queryMethod: string;
    /** The arguments the query should be called with. */
    queryArgs: unknown[];
    /** The query variant (e.g. `"get"`). */
    variant: Variant;
    /** Renders the suggestion as callable source, e.g. `getByText('Save')`. */
    toString: () => string;
};

const makeSuggestion = (queryName: Method, variant: Variant, queryArgs: unknown[], argsText: string): Suggestion => {
    const queryMethod = `${variant}By${queryName}`;
    return {
        queryName,
        queryMethod,
        queryArgs,
        variant,
        toString: () => `${queryMethod}(${argsText})`,
    };
};

const roleSuggestion = (widget: Gtk.Widget, variant: Variant): Suggestion | undefined => {
    const role = widget.getAccessibleRole();
    if (role === Gtk.AccessibleRole.NONE || role === Gtk.AccessibleRole.GENERIC) return undefined;

    const roleText = `Gtk.AccessibleRole.${formatRole(role).toUpperCase()}`;
    const name = getWidgetAccessibleName(widget);
    if (name === null) {
        return makeSuggestion("Role", variant, [role], roleText);
    }
    return makeSuggestion("Role", variant, [role, { name }], `${roleText}, { name: '${name}' }`);
};

const textSuggestion = (queryName: Method, variant: Variant, value: string | null): Suggestion | undefined => {
    if (value === null) return undefined;
    return makeSuggestion(queryName, variant, [value], `'${value}'`);
};

/**
 * Returns the recommended query for a widget, preferring the most accessible
 * axis available: role (with accessible name) first, then label text,
 * placeholder text, visible text, display value, and finally widget name (the
 * GTK analog of a test id). Mirrors `getSuggestedQuery` from
 * `@testing-library/dom`.
 *
 * @param widget - The widget to suggest a query for
 * @param variant - The query variant to recommend (defaults to `"get"`)
 * @param method - Restrict the suggestion to a single axis; omit to pick the best
 * @returns The recommended query, or `undefined` if no axis applies
 *
 * @example
 * ```tsx
 * import { getSuggestedQuery } from "@gtkx/testing";
 *
 * const suggestion = getSuggestedQuery(button);
 * console.log(suggestion?.toString()); // getByRole(Gtk.AccessibleRole.BUTTON, { name: 'Save' })
 * ```
 */
export const getSuggestedQuery = (
    widget: Gtk.Widget,
    variant: Variant = "get",
    method?: Method,
): Suggestion | undefined => {
    const builders: Record<Method, () => Suggestion | undefined> = {
        Role: () => roleSuggestion(widget, variant),
        LabelText: () =>
            textSuggestion("LabelText", variant, getWidgetOwnLabel(widget) ?? getWidgetLabelledByText(widget)),
        PlaceholderText: () => textSuggestion("PlaceholderText", variant, getWidgetPlaceholderText(widget)),
        Text: () => textSuggestion("Text", variant, getWidgetText(widget)),
        DisplayValue: () => textSuggestion("DisplayValue", variant, getWidgetDisplayValue(widget)),
        Name: () => textSuggestion("Name", variant, getWidgetName(widget)),
    };

    if (method) {
        return builders[method]();
    }

    const priority: Method[] = ["Role", "LabelText", "PlaceholderText", "Text", "DisplayValue", "Name"];
    for (const candidate of priority) {
        const suggestion = builders[candidate]();
        if (suggestion) return suggestion;
    }
    return undefined;
};
