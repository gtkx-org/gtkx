import * as Gtk from "@gtkx/gi/gtk";
import { formatRole } from "./role-helpers.js";
import {
    getWidgetAccessibleName,
    getWidgetDisplayValue,
    getWidgetLabelledByText,
    getWidgetLabelText,
    getWidgetName,
    getWidgetOwnLabel,
    getWidgetPlaceholderText,
} from "./widget-text.js";

export type Variant = "get" | "getAll" | "query" | "queryAll" | "find" | "findAll";

export type Method = "Role" | "LabelText" | "PlaceholderText" | "Text" | "DisplayValue" | "Name";

export type Suggestion = {
    queryName: Method;
    queryMethod: string;
    variant: Variant;
    toString: () => string;
};

const makeSuggestion = (queryName: Method, variant: Variant, argsText: string): Suggestion => {
    const queryMethod = `${variant}By${queryName}`;
    return {
        queryName,
        queryMethod,
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
        return makeSuggestion("Role", variant, roleText);
    }
    return makeSuggestion("Role", variant, `${roleText}, { name: '${name}' }`);
};

const textSuggestion = (queryName: Method, variant: Variant, value: string | null): Suggestion | undefined => {
    if (value === null) return undefined;
    return makeSuggestion(queryName, variant, `'${value}'`);
};

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
        Text: () => textSuggestion("Text", variant, getWidgetLabelText(widget)),
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
