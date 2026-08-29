import * as Gtk from "@gtkx/gi/gtk";
import type {
    ByRoleOptions,
    ByRoleValue,
    Matcher,
    MatcherOptions,
    NormalizerFn,
    QueryFamilies,
} from "./types.js";
import { buildQueries, type BuiltQueries, type QueryAllBy } from "./build-queries.js";
import { multipleFoundError, notFoundError } from "./errors.js";
import { getDefaultNormalizer } from "./normalize.js";
import { type Container, findAll, traverse } from "./traversal.js";
import {
    getWidgetAccessibleName,
    getWidgetBusyState,
    getWidgetDescription,
    getWidgetDisplayValue,
    getWidgetExpandedState,
    getWidgetExternalLabelText,
    getWidgetLabelText,
    getWidgetLevel,
    getWidgetName,
    getWidgetOwnLabel,
    getWidgetPlaceholderText,
    getWidgetPressedState,
    getWidgetSelectedState,
    getWidgetValueText,
    isInaccessible,
    isWidgetChecked,
    isWidgetValueMatch,
    namingLabelText,
    type WidgetValueField,
} from "./widget-accessible-properties.js";

/** The built-in queries in their unbound form, each taking the container to search as its first argument. */
type BuiltinQueries = QueryFamilies<[container: Container]>;

const roleQueries = nameQueryFamily(
    "Role",
    queryAllByRole,
    buildQueries<[role: Gtk.AccessibleRole, options?: ByRoleOptions]>(
        queryAllByRole,
        (container, matches, role, options) =>
            multipleFoundError(container, { queryType: "role", role, options }, matches),
        (container, role, options) => notFoundError(container, { queryType: "role", role, options }),
    ),
);

const labelTextQueries = nameQueryFamily(
    "LabelText",
    queryAllByLabelText,
    buildQueries<[text: Matcher, options?: MatcherOptions]>(
        queryAllByLabelText,
        (container, matches, text) => multipleFoundError(container, { queryType: "labelText", text }, matches),
        (container, text) => notFoundError(container, { queryType: "labelText", text }),
    ),
);

const textQueries = nameQueryFamily(
    "Text",
    queryAllByText,
    buildQueries<[text: Matcher, options?: MatcherOptions]>(
        queryAllByText,
        (container, matches, text) => multipleFoundError(container, { queryType: "text", text }, matches),
        (container, text) => notFoundError(container, { queryType: "text", text }),
    ),
);

const nameQueries = nameQueryFamily(
    "Name",
    queryAllByName,
    buildQueries<[name: Matcher, options?: MatcherOptions]>(
        queryAllByName,
        (container, matches, name) => multipleFoundError(container, { queryType: "name", name }, matches),
        (container, name) => notFoundError(container, { queryType: "name", name }),
    ),
);

const placeholderTextQueries = nameQueryFamily(
    "PlaceholderText",
    queryAllByPlaceholderText,
    buildQueries<[text: Matcher, options?: MatcherOptions]>(
        queryAllByPlaceholderText,
        (container, matches, text) => multipleFoundError(container, { queryType: "placeholderText", text }, matches),
        (container, text) => notFoundError(container, { queryType: "placeholderText", text }),
    ),
);

const displayValueQueries = nameQueryFamily(
    "DisplayValue",
    queryAllByDisplayValue,
    buildQueries<[value: Matcher, options?: MatcherOptions]>(
        queryAllByDisplayValue,
        (container, matches, value) => multipleFoundError(container, { queryType: "displayValue", value }, matches),
        (container, value) => notFoundError(container, { queryType: "displayValue", value }),
    ),
);

const builtinQueries = {
    ...roleQueries,
    ...labelTextQueries,
    ...textQueries,
    ...nameQueries,
    ...placeholderTextQueries,
    ...displayValueQueries,
} as BuiltinQueries;

/** Queries one mapped widget by accessible role. */
const queryByRole: BuiltinQueries["queryByRole"] = builtinQueries.queryByRole;
/** Gets all mapped widgets with an accessible role. */
const getAllByRole: BuiltinQueries["getAllByRole"] = builtinQueries.getAllByRole;
/** Gets one mapped widget by accessible role. */
const getByRole: BuiltinQueries["getByRole"] = builtinQueries.getByRole;
/** Finds all mapped widgets with an accessible role. */
const findAllByRole: BuiltinQueries["findAllByRole"] = builtinQueries.findAllByRole;
/** Finds one mapped widget by accessible role. */
const findByRole: BuiltinQueries["findByRole"] = builtinQueries.findByRole;
/** Queries one mapped widget by label text. */
const queryByLabelText: BuiltinQueries["queryByLabelText"] = builtinQueries.queryByLabelText;
/** Gets all mapped widgets with label text. */
const getAllByLabelText: BuiltinQueries["getAllByLabelText"] = builtinQueries.getAllByLabelText;
/** Gets one mapped widget by label text. */
const getByLabelText: BuiltinQueries["getByLabelText"] = builtinQueries.getByLabelText;
/** Finds all mapped widgets with label text. */
const findAllByLabelText: BuiltinQueries["findAllByLabelText"] = builtinQueries.findAllByLabelText;
/** Finds one mapped widget by label text. */
const findByLabelText: BuiltinQueries["findByLabelText"] = builtinQueries.findByLabelText;
/** Queries one mapped widget by rendered text. */
const queryByText: BuiltinQueries["queryByText"] = builtinQueries.queryByText;
/** Gets all mapped widgets with rendered text. */
const getAllByText: BuiltinQueries["getAllByText"] = builtinQueries.getAllByText;
/** Gets one mapped widget by rendered text. */
const getByText: BuiltinQueries["getByText"] = builtinQueries.getByText;
/** Finds all mapped widgets with rendered text. */
const findAllByText: BuiltinQueries["findAllByText"] = builtinQueries.findAllByText;
/** Finds one mapped widget by rendered text. */
const findByText: BuiltinQueries["findByText"] = builtinQueries.findByText;
/** Queries one mapped widget by GTK name. */
const queryByName: BuiltinQueries["queryByName"] = builtinQueries.queryByName;
/** Gets all mapped widgets with a GTK name. */
const getAllByName: BuiltinQueries["getAllByName"] = builtinQueries.getAllByName;
/** Gets one mapped widget by GTK name. */
const getByName: BuiltinQueries["getByName"] = builtinQueries.getByName;
/** Finds all mapped widgets with a GTK name. */
const findAllByName: BuiltinQueries["findAllByName"] = builtinQueries.findAllByName;
/** Finds one mapped widget by GTK name. */
const findByName: BuiltinQueries["findByName"] = builtinQueries.findByName;
/** Queries one mapped widget by placeholder text. */
const queryByPlaceholderText: BuiltinQueries["queryByPlaceholderText"] = builtinQueries.queryByPlaceholderText;
/** Gets all mapped widgets with placeholder text. */
const getAllByPlaceholderText: BuiltinQueries["getAllByPlaceholderText"] = builtinQueries.getAllByPlaceholderText;
/** Gets one mapped widget by placeholder text. */
const getByPlaceholderText: BuiltinQueries["getByPlaceholderText"] = builtinQueries.getByPlaceholderText;
/** Finds all mapped widgets with placeholder text. */
const findAllByPlaceholderText: BuiltinQueries["findAllByPlaceholderText"] = builtinQueries.findAllByPlaceholderText;
/** Finds one mapped widget by placeholder text. */
const findByPlaceholderText: BuiltinQueries["findByPlaceholderText"] = builtinQueries.findByPlaceholderText;
/** Queries one mapped widget by display value. */
const queryByDisplayValue: BuiltinQueries["queryByDisplayValue"] = builtinQueries.queryByDisplayValue;
/** Gets all mapped widgets with a display value. */
const getAllByDisplayValue: BuiltinQueries["getAllByDisplayValue"] = builtinQueries.getAllByDisplayValue;
/** Gets one mapped widget by display value. */
const getByDisplayValue: BuiltinQueries["getByDisplayValue"] = builtinQueries.getByDisplayValue;
/** Finds all mapped widgets with a display value. */
const findAllByDisplayValue: BuiltinQueries["findAllByDisplayValue"] = builtinQueries.findAllByDisplayValue;
/** Finds one mapped widget by display value. */
const findByDisplayValue: BuiltinQueries["findByDisplayValue"] = builtinQueries.findByDisplayValue;

const buildNormalizer = (options?: MatcherOptions): NormalizerFn => {
    const { normalizer, trim, collapseWhitespace } = options ?? {};

    if (!normalizer) {
        return getDefaultNormalizer({ trim, collapseWhitespace });
    }

    if (trim !== undefined || collapseWhitespace !== undefined) {
        throw new Error(
            "trim and collapseWhitespace are not supported with a normalizer. " +
            "If you want to use the default trim and collapseWhitespace logic in your normalizer, " +
            "use \"getDefaultNormalizer({ trim, collapseWhitespace })\" and compose that into your normalizer",
        );
    }

    return normalizer;
};

const normalizeText = (text: string, options?: MatcherOptions): string => {
    const normalizer = buildNormalizer(options);

    return normalizer(text);
};

const isTextMatch = (
    actual: string | null,
    expected: Matcher,
    widget: Gtk.Widget,
    options?: MatcherOptions,
): boolean => {
    if (actual === null) {
        return false;
    }

    const normalizedActual = normalizeText(actual, options);

    if (typeof expected === "function") {
        return expected(normalizedActual, widget);
    }

    if (expected instanceof RegExp) {
        expected.lastIndex = 0;

        return expected.test(normalizedActual);
    }

    const normalizedExpected = normalizeText(String(expected), options);
    const isExact = options?.exact ?? true;

    return isExact
        ? normalizedActual === normalizedExpected
        : normalizedActual.toLowerCase().includes(normalizedExpected.toLowerCase());
};

const hasMatchingAccessibleName = (widget: Gtk.Widget, options: ByRoleOptions): boolean => {
    if (options.name === undefined) {
        return true;
    }

    const text = getWidgetAccessibleName(widget);

    return isTextMatch(text, options.name, widget, options);
};

const isNumericValueMatch = (widget: Gtk.Widget, field: WidgetValueField, expected: number | undefined): boolean =>
    expected === undefined || isWidgetValueMatch(widget, field, expected);

const hasMatchingAccessibleValue = (widget: Gtk.Widget, value: ByRoleValue, options: ByRoleOptions): boolean => {
    const numericChecks: [WidgetValueField, number | undefined][] = [
        ["now", value.now],
        ["min", value.min],
        ["max", value.max],
    ];

    for (const [field, expected] of numericChecks) {
        if (!isNumericValueMatch(widget, field, expected)) {
            return false;
        }
    }

    return value.text === undefined || isTextMatch(getWidgetValueText(widget), value.text, widget, options);
};

const hasMatchingBooleanStates = (widget: Gtk.Widget, options: ByRoleOptions): boolean => {
    const stateChecks: [boolean | undefined, () => boolean | null][] = [
        [options.checked, () => isWidgetChecked(widget)],
        [options.pressed, () => getWidgetPressedState(widget)],
        [options.expanded, () => getWidgetExpandedState(widget)],
        [options.selected, () => getWidgetSelectedState(widget)],
        [options.busy, () => getWidgetBusyState(widget) ?? false],
    ];

    for (const [expected, getActual] of stateChecks) {
        if (expected !== undefined && getActual() !== expected) {
            return false;
        }
    }

    return true;
};

const hasMatchingLevelState = (widget: Gtk.Widget, options: ByRoleOptions): boolean =>
    options.level === undefined || getWidgetLevel(widget) === options.level;

const hasMatchingDescriptionState = (widget: Gtk.Widget, options: ByRoleOptions): boolean =>
    options.description === undefined ||
    isTextMatch(getWidgetDescription(widget), options.description, widget, options);

const hasMatchingValueState = (widget: Gtk.Widget, options: ByRoleOptions): boolean =>
    options.value === undefined || hasMatchingAccessibleValue(widget, options.value, options);

const hasMatchingAccessibleStates = (widget: Gtk.Widget, options: ByRoleOptions): boolean =>
    hasMatchingBooleanStates(widget, options) &&
    hasMatchingLevelState(widget, options) &&
    hasMatchingDescriptionState(widget, options) &&
    hasMatchingValueState(widget, options);

const isMatchingWidgetType = (widget: Gtk.Widget, options?: MatcherOptions): boolean =>
    options?.as === undefined || widget instanceof options.as;

const hasMatchingByRoleOptions = (widget: Gtk.Widget, options?: ByRoleOptions): boolean => {
    if (!options) {
        return true;
    }

    return (
        isMatchingWidgetType(widget, options) &&
        hasMatchingAccessibleName(widget, options) &&
        hasMatchingAccessibleStates(widget, options)
    );
};

function nameQueryFamily<Args extends unknown[]>(
    suffix: string,
    queryAllBy: QueryAllBy<Args>,
    built: BuiltQueries<Args>,
): Record<string, unknown> {
    const [queryBy, getAllBy, getBy, findAllBy, findBy] = built;

    return {
        [`queryBy${suffix}`]: queryBy,
        [`queryAllBy${suffix}`]: queryAllBy,
        [`getBy${suffix}`]: getBy,
        [`getAllBy${suffix}`]: getAllBy,
        [`findBy${suffix}`]: findBy,
        [`findAllBy${suffix}`]: findAllBy,
    };
}

/**
 * Finds every widget under the container whose accessible role matches `role` and that satisfies the given options.
 * Widgets that are not mapped are never matched, and widgets excluded from the accessibility tree are
 * skipped unless `options.hidden` is set.
 * @param container Widget subtree to search.
 * @param role Accessible role to match.
 * @param options Additional accessible name, state, and value constraints.
 * @returns Every matching widget, or an empty array when none match.
 */
function queryAllByRole(
    container: Container,
    role: Gtk.AccessibleRole,
    options?: ByRoleOptions,
): Gtk.Widget[] {
    return findAll(container, (widget) => {
        if (widget.getAccessibleRole() !== role) {
            return false;
        }

        if (!options?.hidden && isInaccessible(widget)) {
            return false;
        }

        return hasMatchingByRoleOptions(widget, options);
    });
}

const collectMnemonicMatch = (
    widget: Gtk.Widget,
    text: Matcher,
    options: MatcherOptions | undefined,
): Gtk.Widget | null => {
    if (!(widget instanceof Gtk.Label)) {
        return null;
    }

    const labelText = namingLabelText(widget);

    if (!labelText || !isTextMatch(labelText, text, widget, options)) {
        return null;
    }

    return widget.getMnemonicWidget();
};

const labellingText = (widget: Gtk.Widget): string | null => {
    const ownLabel = widget.getAccessibleRole() === Gtk.AccessibleRole.LABEL ? null : getWidgetOwnLabel(widget);

    return ownLabel ?? getWidgetExternalLabelText(widget);
};

const collectLabelMatches = (
    results: Set<Gtk.Widget>,
    widget: Gtk.Widget,
    text: Matcher,
    options: MatcherOptions | undefined,
): void => {
    const mnemonicTarget = collectMnemonicMatch(widget, text, options);

    if (mnemonicTarget) {
        results.add(mnemonicTarget);
    }

    const labelText = labellingText(widget);

    if (labelText !== null && isTextMatch(labelText, text, widget, options)) {
        results.add(widget);
    }
};

/**
 * Finds every widget associated with a label whose text matches: a Gtk.Label mnemonic target, the
 * widget's own accessible label, or its labelled-by relation. Widgets that are not mapped are never matched.
 * @param container Widget subtree to search.
 * @param text Matcher for the label text.
 * @param options Text matching options.
 * @returns Every matching widget, or an empty array when none match.
 */
function queryAllByLabelText(container: Container, text: Matcher, options?: MatcherOptions): Gtk.Widget[] {
    const results: Set<Gtk.Widget> = new Set();

    for (const widget of traverse(container)) {
        collectLabelMatches(results, widget, text, options);
    }

    return [...results].filter((widget) => isMatchingWidgetType(widget, options));
}

/**
 * Finds every widget whose rendered text content matches. Widgets that are not mapped are never matched.
 * @param container Widget subtree to search.
 * @param text Matcher for the widget text.
 * @param options Text matching options.
 * @returns Every matching widget, or an empty array when none match.
 */
function queryAllByText(container: Container, text: Matcher, options?: MatcherOptions): Gtk.Widget[] {
    return findAll(
        container,
        (widget) =>
            isMatchingWidgetType(widget, options) && isTextMatch(getWidgetLabelText(widget), text, widget, options),
    );
}

/**
 * Finds every widget whose widget name matches. Widgets that are not mapped are never matched.
 * @param container Widget subtree to search.
 * @param name Matcher for the widget name.
 * @param options Text matching options.
 * @returns Every matching widget, or an empty array when none match.
 */
function queryAllByName(container: Container, name: Matcher, options?: MatcherOptions): Gtk.Widget[] {
    return findAll(
        container,
        (widget) => isMatchingWidgetType(widget, options) && isTextMatch(getWidgetName(widget), name, widget, options),
    );
}

/**
 * Finds every widget whose placeholder text matches. Widgets that are not mapped are never matched.
 * @param container Widget subtree to search.
 * @param text Matcher for the placeholder text.
 * @param options Text matching options.
 * @returns Every matching widget, or an empty array when none match.
 */
function queryAllByPlaceholderText(
    container: Container,
    text: Matcher,
    options?: MatcherOptions,
): Gtk.Widget[] {
    return findAll(
        container,
        (widget) =>
            isMatchingWidgetType(widget, options) &&
            isTextMatch(getWidgetPlaceholderText(widget), text, widget, options),
    );
}

/**
 * Finds every widget whose current display value matches. Widgets that are not mapped are never matched.
 * @param container Widget subtree to search.
 * @param value Matcher for the display value.
 * @param options Text matching options.
 * @returns Every matching widget, or an empty array when none match.
 */
function queryAllByDisplayValue(container: Container, value: Matcher, options?: MatcherOptions): Gtk.Widget[] {
    return findAll(
        container,
        (widget) =>
            isMatchingWidgetType(widget, options) &&
            isTextMatch(getWidgetDisplayValue(widget), value, widget, options),
    );
}

export {
    builtinQueries,
    isMatchingWidgetType,
    isTextMatch,
    queryByRole,
    getAllByRole,
    getByRole,
    findAllByRole,
    findByRole,
    queryByLabelText,
    getAllByLabelText,
    getByLabelText,
    findAllByLabelText,
    findByLabelText,
    queryByText,
    getAllByText,
    getByText,
    findAllByText,
    findByText,
    queryByName,
    getAllByName,
    getByName,
    findAllByName,
    findByName,
    queryByPlaceholderText,
    getAllByPlaceholderText,
    getByPlaceholderText,
    findAllByPlaceholderText,
    findByPlaceholderText,
    queryByDisplayValue,
    getAllByDisplayValue,
    getByDisplayValue,
    findAllByDisplayValue,
    findByDisplayValue,
    queryAllByRole,
    queryAllByLabelText,
    queryAllByText,
    queryAllByName,
    queryAllByPlaceholderText,
    queryAllByDisplayValue,
};
