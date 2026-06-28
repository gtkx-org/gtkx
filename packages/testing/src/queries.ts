import * as Gtk from "@gtkx/gi/gtk";
import { multipleFoundError, notFoundError } from "./errors.js";
import { type BuiltQueries, buildQueries, type QueryAllBy } from "./query-helpers.js";
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
    getWidgetLabelText,
    getWidgetLevel,
    getWidgetName,
    getWidgetOwnLabel,
    getWidgetPlaceholderText,
    getWidgetPressedState,
    getWidgetSelectedState,
    getWidgetValue,
    isInaccessible,
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

type NamedFamily<Suffix extends string, Args extends unknown[]> = {
    [P in `queryBy${Suffix}`]: (container: Container, ...args: Args) => Gtk.Widget | null;
} & {
    [P in `queryAllBy${Suffix}`]: (container: Container, ...args: Args) => Gtk.Widget[];
} & {
    [P in `getBy${Suffix}`]: (container: Container, ...args: Args) => Gtk.Widget;
} & {
    [P in `getAllBy${Suffix}`]: (container: Container, ...args: Args) => Gtk.Widget[];
} & {
    [P in `findBy${Suffix}`]: (container: Container, ...args: Args) => Promise<Gtk.Widget>;
} & {
    [P in `findAllBy${Suffix}`]: (container: Container, ...args: Args) => Promise<Gtk.Widget[]>;
};

const nameQueryFamily = <Suffix extends string, Args extends unknown[]>(
    suffix: Suffix,
    queryAllBy: QueryAllBy<Args>,
    built: BuiltQueries<Args>,
): NamedFamily<Suffix, Args> => {
    const family = {
        [`queryBy${suffix}`]: built.queryBy,
        [`queryAllBy${suffix}`]: queryAllBy,
        [`getBy${suffix}`]: built.getBy,
        [`getAllBy${suffix}`]: built.getAllBy,
        [`findBy${suffix}`]: built.findBy,
        [`findAllBy${suffix}`]: built.findAllBy,
    };
    return family as NamedFamily<Suffix, Args>;
};

export const queryAllByRole = (container: Container, role: Gtk.AccessibleRole, options?: ByRoleOptions): Gtk.Widget[] =>
    findAll(container, (widget) => {
        if (widget.getAccessibleRole() !== role) return false;
        if (!options?.hidden && isInaccessible(widget)) return false;
        return matchByRoleOptions(widget, options);
    });

const roleQueries = nameQueryFamily(
    "Role",
    queryAllByRole,
    buildQueries<[role: Gtk.AccessibleRole, options?: ByRoleOptions]>(
        "Role",
        queryAllByRole,
        (container, matches, role, options) =>
            multipleFoundError(container, { queryType: "role", role, options }, matches),
        (container, role, options) => notFoundError(container, { queryType: "role", role, options }),
    ),
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

const labelTextQueries = nameQueryFamily(
    "LabelText",
    queryAllByLabelText,
    buildQueries<[text: Matcher, options?: MatcherOptions]>(
        "LabelText",
        queryAllByLabelText,
        (container, matches, text) => multipleFoundError(container, { queryType: "labelText", text }, matches),
        (container, text) => notFoundError(container, { queryType: "labelText", text }),
    ),
);

export const queryAllByText = (container: Container, text: Matcher, options?: MatcherOptions): Gtk.Widget[] =>
    findAll(container, (widget) => matchText(getWidgetLabelText(widget), text, widget, options));

const textQueries = nameQueryFamily(
    "Text",
    queryAllByText,
    buildQueries<[text: Matcher, options?: MatcherOptions]>(
        "Text",
        queryAllByText,
        (container, matches, text) => multipleFoundError(container, { queryType: "text", text }, matches),
        (container, text) => notFoundError(container, { queryType: "text", text }),
    ),
);

export const queryAllByName = (container: Container, name: Matcher, options?: MatcherOptions): Gtk.Widget[] =>
    findAll(container, (widget) => matchText(getWidgetName(widget), name, widget, options));

const nameQueries = nameQueryFamily(
    "Name",
    queryAllByName,
    buildQueries<[name: Matcher, options?: MatcherOptions]>(
        "Name",
        queryAllByName,
        (container, matches, name) => multipleFoundError(container, { queryType: "name", name }, matches),
        (container, name) => notFoundError(container, { queryType: "name", name }),
    ),
);

export const queryAllByPlaceholderText = (
    container: Container,
    text: Matcher,
    options?: MatcherOptions,
): Gtk.Widget[] => findAll(container, (widget) => matchText(getWidgetPlaceholderText(widget), text, widget, options));

const placeholderTextQueries = nameQueryFamily(
    "PlaceholderText",
    queryAllByPlaceholderText,
    buildQueries<[text: Matcher, options?: MatcherOptions]>(
        "PlaceholderText",
        queryAllByPlaceholderText,
        (container, matches, text) => multipleFoundError(container, { queryType: "placeholderText", text }, matches),
        (container, text) => notFoundError(container, { queryType: "placeholderText", text }),
    ),
);

export const queryAllByDisplayValue = (container: Container, value: Matcher, options?: MatcherOptions): Gtk.Widget[] =>
    findAll(container, (widget) => matchText(getWidgetDisplayValue(widget), value, widget, options));

const displayValueQueries = nameQueryFamily(
    "DisplayValue",
    queryAllByDisplayValue,
    buildQueries<[value: Matcher, options?: MatcherOptions]>(
        "DisplayValue",
        queryAllByDisplayValue,
        (container, matches, value) => multipleFoundError(container, { queryType: "displayValue", value }, matches),
        (container, value) => notFoundError(container, { queryType: "displayValue", value }),
    ),
);

export type BuiltinQueries = NamedFamily<"Role", [role: Gtk.AccessibleRole, options?: ByRoleOptions]> &
    NamedFamily<"LabelText", [text: Matcher, options?: MatcherOptions]> &
    NamedFamily<"Text", [text: Matcher, options?: MatcherOptions]> &
    NamedFamily<"Name", [name: Matcher, options?: MatcherOptions]> &
    NamedFamily<"PlaceholderText", [text: Matcher, options?: MatcherOptions]> &
    NamedFamily<"DisplayValue", [value: Matcher, options?: MatcherOptions]>;

export const builtinQueries: BuiltinQueries = {
    ...roleQueries,
    ...labelTextQueries,
    ...textQueries,
    ...nameQueries,
    ...placeholderTextQueries,
    ...displayValueQueries,
};

export const queryByRole: BuiltinQueries["queryByRole"] = roleQueries.queryByRole;
export const getAllByRole: BuiltinQueries["getAllByRole"] = roleQueries.getAllByRole;
export const getByRole: BuiltinQueries["getByRole"] = roleQueries.getByRole;
export const findAllByRole: BuiltinQueries["findAllByRole"] = roleQueries.findAllByRole;
export const findByRole: BuiltinQueries["findByRole"] = roleQueries.findByRole;

export const queryByLabelText: BuiltinQueries["queryByLabelText"] = labelTextQueries.queryByLabelText;
export const getAllByLabelText: BuiltinQueries["getAllByLabelText"] = labelTextQueries.getAllByLabelText;
export const getByLabelText: BuiltinQueries["getByLabelText"] = labelTextQueries.getByLabelText;
export const findAllByLabelText: BuiltinQueries["findAllByLabelText"] = labelTextQueries.findAllByLabelText;
export const findByLabelText: BuiltinQueries["findByLabelText"] = labelTextQueries.findByLabelText;

export const queryByText: BuiltinQueries["queryByText"] = textQueries.queryByText;
export const getAllByText: BuiltinQueries["getAllByText"] = textQueries.getAllByText;
export const getByText: BuiltinQueries["getByText"] = textQueries.getByText;
export const findAllByText: BuiltinQueries["findAllByText"] = textQueries.findAllByText;
export const findByText: BuiltinQueries["findByText"] = textQueries.findByText;

export const queryByName: BuiltinQueries["queryByName"] = nameQueries.queryByName;
export const getAllByName: BuiltinQueries["getAllByName"] = nameQueries.getAllByName;
export const getByName: BuiltinQueries["getByName"] = nameQueries.getByName;
export const findAllByName: BuiltinQueries["findAllByName"] = nameQueries.findAllByName;
export const findByName: BuiltinQueries["findByName"] = nameQueries.findByName;

export const queryByPlaceholderText: BuiltinQueries["queryByPlaceholderText"] =
    placeholderTextQueries.queryByPlaceholderText;
export const getAllByPlaceholderText: BuiltinQueries["getAllByPlaceholderText"] =
    placeholderTextQueries.getAllByPlaceholderText;
export const getByPlaceholderText: BuiltinQueries["getByPlaceholderText"] = placeholderTextQueries.getByPlaceholderText;
export const findAllByPlaceholderText: BuiltinQueries["findAllByPlaceholderText"] =
    placeholderTextQueries.findAllByPlaceholderText;
export const findByPlaceholderText: BuiltinQueries["findByPlaceholderText"] =
    placeholderTextQueries.findByPlaceholderText;

export const queryByDisplayValue: BuiltinQueries["queryByDisplayValue"] = displayValueQueries.queryByDisplayValue;
export const getAllByDisplayValue: BuiltinQueries["getAllByDisplayValue"] = displayValueQueries.getAllByDisplayValue;
export const getByDisplayValue: BuiltinQueries["getByDisplayValue"] = displayValueQueries.getByDisplayValue;
export const findAllByDisplayValue: BuiltinQueries["findAllByDisplayValue"] = displayValueQueries.findAllByDisplayValue;
export const findByDisplayValue: BuiltinQueries["findByDisplayValue"] = displayValueQueries.findByDisplayValue;
