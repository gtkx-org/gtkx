import * as Gtk from "@gtkx/gi/gtk";
import { multipleFoundError, notFoundError } from "./errors.js";
import { type BuiltQueries, buildQueries } from "./query-helpers.js";
import { type Container, findAll, traverse } from "./traversal.js";
import type { ByRoleOptions, ByRoleValue, Matcher, MatcherOptions, NormalizerFn, NormalizerOptions } from "./types.js";
import {
    getWidgetAccessibleName,
    getWidgetBusyState,
    getWidgetCheckedState,
    getWidgetDescription,
    getWidgetDisplayValue,
    getWidgetExpandedState,
    getWidgetLabelledByText,
    getWidgetLevel,
    getWidgetName,
    getWidgetOwnLabel,
    getWidgetPlaceholderText,
    getWidgetPressedState,
    getWidgetSelectedState,
    getWidgetText,
    getWidgetValue,
    isHiddenFromAccessibility,
} from "./widget-text.js";

export const getDefaultNormalizer = ({
    trim = true,
    collapseWhitespace = true,
}: NormalizerOptions = {}): NormalizerFn => {
    return (text: string): string => {
        let result = text;
        if (trim) {
            result = result.trim();
        }

        if (collapseWhitespace) {
            result = result.replaceAll(/\s+/g, " ");
        }

        return result;
    };
};

const buildNormalizer = (options?: MatcherOptions): NormalizerFn => {
    const { normalizer, trim, collapseWhitespace } = options ?? {};

    if (!normalizer) {
        return getDefaultNormalizer({ trim, collapseWhitespace });
    }

    if (trim !== undefined || collapseWhitespace !== undefined) {
        throw new Error(
            "trim and collapseWhitespace are not supported with a normalizer. " +
                "If you want to use the default trim and collapseWhitespace logic in your normalizer, " +
                'use "getDefaultNormalizer({ trim, collapseWhitespace })" and compose that into your normalizer',
        );
    }

    return normalizer;
};

const normalizeText = (text: string, options?: MatcherOptions): string => {
    const normalizer = buildNormalizer(options);
    return normalizer(text);
};

const matchText = (actual: string | null, expected: Matcher, widget: Gtk.Widget, options?: MatcherOptions): boolean => {
    if (actual === null) return false;

    const normalizedActual = normalizeText(actual, options);

    if (typeof expected === "function") {
        return expected(normalizedActual, widget);
    }

    if (expected instanceof RegExp) {
        expected.lastIndex = 0;
        return expected.test(normalizedActual);
    }

    const normalizedExpected = normalizeText(String(expected), options);
    const exact = options?.exact ?? true;
    return exact
        ? normalizedActual === normalizedExpected
        : normalizedActual.toLowerCase().includes(normalizedExpected.toLowerCase());
};

const matchAccessibleName = (widget: Gtk.Widget, options: ByRoleOptions): boolean => {
    if (options.name === undefined) return true;
    const text = getWidgetAccessibleName(widget);
    return matchText(text, options.name, widget, options);
};

const matchAccessibleValue = (widget: Gtk.Widget, value: ByRoleValue, options: ByRoleOptions): boolean => {
    const actual = getWidgetValue(widget);
    if (value.now !== undefined && actual.now !== value.now) return false;
    if (value.min !== undefined && actual.min !== value.min) return false;
    if (value.max !== undefined && actual.max !== value.max) return false;
    if (value.text !== undefined && !matchText(actual.text, value.text, widget, options)) return false;
    return true;
};

const matchBooleanStates = (widget: Gtk.Widget, options: ByRoleOptions): boolean => {
    if (options.checked !== undefined && getWidgetCheckedState(widget) !== options.checked) return false;
    if (options.pressed !== undefined && getWidgetPressedState(widget) !== options.pressed) return false;
    if (options.expanded !== undefined && getWidgetExpandedState(widget) !== options.expanded) return false;
    if (options.selected !== undefined && getWidgetSelectedState(widget) !== options.selected) return false;
    if (options.busy !== undefined && (getWidgetBusyState(widget) ?? false) !== options.busy) return false;
    return true;
};

const matchAccessibleStates = (widget: Gtk.Widget, options: ByRoleOptions): boolean => {
    if (!matchBooleanStates(widget, options)) return false;
    if (options.level !== undefined && getWidgetLevel(widget) !== options.level) return false;
    if (
        options.description !== undefined &&
        !matchText(getWidgetDescription(widget), options.description, widget, options)
    )
        return false;
    if (options.value !== undefined && !matchAccessibleValue(widget, options.value, options)) return false;
    return true;
};

const matchByRoleOptions = (widget: Gtk.Widget, options?: ByRoleOptions): boolean => {
    if (!options) return true;
    return matchAccessibleName(widget, options) && matchAccessibleStates(widget, options);
};

export const queryAllByRole = (container: Container, role: Gtk.AccessibleRole, options?: ByRoleOptions): Gtk.Widget[] =>
    findAll(container, (widget) => {
        if (widget.getAccessibleRole() !== role) return false;
        if (!options?.hidden && isHiddenFromAccessibility(widget)) return false;
        return matchByRoleOptions(widget, options);
    });

const roleVariants = buildQueries<[role: Gtk.AccessibleRole, options?: ByRoleOptions]>(
    "Role",
    queryAllByRole,
    (container, matches, role, options) => multipleFoundError(container, { queryType: "role", role, options }, matches),
    (container, role, options) => notFoundError(container, { queryType: "role", role, options }),
);

const collectMnemonicMatch = (
    widget: Gtk.Widget,
    text: Matcher,
    options: MatcherOptions | undefined,
): Gtk.Widget | null => {
    if (!(widget instanceof Gtk.Label)) return null;
    const labelText = widget.getLabel();
    if (!labelText || !matchText(labelText, text, widget, options)) return null;
    return widget.getMnemonicWidget();
};

export const queryAllByLabelText = (container: Container, text: Matcher, options?: MatcherOptions): Gtk.Widget[] => {
    const results = new Set<Gtk.Widget>();

    for (const widget of traverse(container)) {
        const mnemonicTarget = collectMnemonicMatch(widget, text, options);
        if (mnemonicTarget) results.add(mnemonicTarget);

        const ownLabel = getWidgetOwnLabel(widget);
        if (ownLabel !== null && matchText(ownLabel, text, widget, options)) results.add(widget);

        const labelledByText = getWidgetLabelledByText(widget);
        if (labelledByText !== null && matchText(labelledByText, text, widget, options)) results.add(widget);
    }

    return [...results];
};

const labelTextVariants = buildQueries<[text: Matcher, options?: MatcherOptions]>(
    "LabelText",
    queryAllByLabelText,
    (container, matches, text) => multipleFoundError(container, { queryType: "labelText", text }, matches),
    (container, text) => notFoundError(container, { queryType: "labelText", text }),
);

export const queryAllByText = (container: Container, text: Matcher, options?: MatcherOptions): Gtk.Widget[] =>
    findAll(container, (widget) => matchText(getWidgetText(widget), text, widget, options));

const textVariants = buildQueries<[text: Matcher, options?: MatcherOptions]>(
    "Text",
    queryAllByText,
    (container, matches, text) => multipleFoundError(container, { queryType: "text", text }, matches),
    (container, text) => notFoundError(container, { queryType: "text", text }),
);

export const queryAllByName = (container: Container, name: Matcher, options?: MatcherOptions): Gtk.Widget[] =>
    findAll(container, (widget) => matchText(getWidgetName(widget), name, widget, options));

const nameVariants = buildQueries<[name: Matcher, options?: MatcherOptions]>(
    "Name",
    queryAllByName,
    (container, matches, name) => multipleFoundError(container, { queryType: "name", name }, matches),
    (container, name) => notFoundError(container, { queryType: "name", name }),
);

export const queryByRole: BuiltQueries<[role: Gtk.AccessibleRole, options?: ByRoleOptions]>["queryBy"] =
    roleVariants.queryBy;
export const getByRole: BuiltQueries<[role: Gtk.AccessibleRole, options?: ByRoleOptions]>["getBy"] = roleVariants.getBy;
export const getAllByRole: BuiltQueries<[role: Gtk.AccessibleRole, options?: ByRoleOptions]>["getAllBy"] =
    roleVariants.getAllBy;
export const findByRole: BuiltQueries<[role: Gtk.AccessibleRole, options?: ByRoleOptions]>["findBy"] =
    roleVariants.findBy;
export const findAllByRole: BuiltQueries<[role: Gtk.AccessibleRole, options?: ByRoleOptions]>["findAllBy"] =
    roleVariants.findAllBy;

export const queryByLabelText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["queryBy"] =
    labelTextVariants.queryBy;
export const getByLabelText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["getBy"] = labelTextVariants.getBy;
export const getAllByLabelText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["getAllBy"] =
    labelTextVariants.getAllBy;
export const findByLabelText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["findBy"] =
    labelTextVariants.findBy;
export const findAllByLabelText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["findAllBy"] =
    labelTextVariants.findAllBy;

export const queryByText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["queryBy"] = textVariants.queryBy;
export const getByText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["getBy"] = textVariants.getBy;
export const getAllByText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["getAllBy"] = textVariants.getAllBy;
export const findByText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["findBy"] = textVariants.findBy;
export const findAllByText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["findAllBy"] =
    textVariants.findAllBy;

export const queryByName: BuiltQueries<[name: Matcher, options?: MatcherOptions]>["queryBy"] = nameVariants.queryBy;
export const getByName: BuiltQueries<[name: Matcher, options?: MatcherOptions]>["getBy"] = nameVariants.getBy;
export const getAllByName: BuiltQueries<[name: Matcher, options?: MatcherOptions]>["getAllBy"] = nameVariants.getAllBy;
export const findByName: BuiltQueries<[name: Matcher, options?: MatcherOptions]>["findBy"] = nameVariants.findBy;
export const findAllByName: BuiltQueries<[name: Matcher, options?: MatcherOptions]>["findAllBy"] =
    nameVariants.findAllBy;

export const queryAllByPlaceholderText = (
    container: Container,
    text: Matcher,
    options?: MatcherOptions,
): Gtk.Widget[] => findAll(container, (widget) => matchText(getWidgetPlaceholderText(widget), text, widget, options));

const placeholderTextVariants = buildQueries<[text: Matcher, options?: MatcherOptions]>(
    "PlaceholderText",
    queryAllByPlaceholderText,
    (container, matches, text) => multipleFoundError(container, { queryType: "placeholderText", text }, matches),
    (container, text) => notFoundError(container, { queryType: "placeholderText", text }),
);

export const queryAllByDisplayValue = (container: Container, value: Matcher, options?: MatcherOptions): Gtk.Widget[] =>
    findAll(container, (widget) => matchText(getWidgetDisplayValue(widget), value, widget, options));

const displayValueVariants = buildQueries<[value: Matcher, options?: MatcherOptions]>(
    "DisplayValue",
    queryAllByDisplayValue,
    (container, matches, value) => multipleFoundError(container, { queryType: "displayValue", value }, matches),
    (container, value) => notFoundError(container, { queryType: "displayValue", value }),
);

export const queryByPlaceholderText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["queryBy"] =
    placeholderTextVariants.queryBy;
export const getByPlaceholderText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["getBy"] =
    placeholderTextVariants.getBy;
export const getAllByPlaceholderText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["getAllBy"] =
    placeholderTextVariants.getAllBy;
export const findByPlaceholderText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["findBy"] =
    placeholderTextVariants.findBy;
export const findAllByPlaceholderText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["findAllBy"] =
    placeholderTextVariants.findAllBy;

export const queryByDisplayValue: BuiltQueries<[value: Matcher, options?: MatcherOptions]>["queryBy"] =
    displayValueVariants.queryBy;
export const getByDisplayValue: BuiltQueries<[value: Matcher, options?: MatcherOptions]>["getBy"] =
    displayValueVariants.getBy;
export const getAllByDisplayValue: BuiltQueries<[value: Matcher, options?: MatcherOptions]>["getAllBy"] =
    displayValueVariants.getAllBy;
export const findByDisplayValue: BuiltQueries<[value: Matcher, options?: MatcherOptions]>["findBy"] =
    displayValueVariants.findBy;
export const findAllByDisplayValue: BuiltQueries<[value: Matcher, options?: MatcherOptions]>["findAllBy"] =
    displayValueVariants.findAllBy;
