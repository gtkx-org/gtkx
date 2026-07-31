import * as Gtk from "@gtkx/gi/gtk";
import type {
    ByRoleOptions,
    ByRoleValue,
    Matcher,
    MatcherOptions,
    NormalizerFn,
    NormalizerOptions,
    QueryFamilies,
} from "./types.js";
import { buildQueries, type BuiltQueries, type QueryAllBy } from "./build-queries.js";
import { multipleFoundError, notFoundError } from "./errors.js";
import { type Container, findAll, traverse } from "./traversal.js";
import {
    getWidgetAccessibleName,
    getWidgetBusyState,
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
    isWidgetChecked,
} from "./widget-accessible-properties.js";

type BuiltinQueries = QueryFamilies<[container: Container]>;

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

const builtinQueries = {
    ...roleQueries,
    ...labelTextQueries,
    ...textQueries,
    ...nameQueries,
    ...placeholderTextQueries,
    ...displayValueQueries,
} as BuiltinQueries;

/**
 * Returns the single widget with a matching accessible role and options, or null when none match.
 * Throws when more than one matches.
 */
const queryByRole: BuiltinQueries["queryByRole"] = builtinQueries.queryByRole;
/** Returns every widget with a matching accessible role and options. Throws when none match. */
const getAllByRole: BuiltinQueries["getAllByRole"] = builtinQueries.getAllByRole;
/**
 * Returns the single widget with a matching accessible role and options.
 * Throws when none or more than one matches.
 */
const getByRole: BuiltinQueries["getByRole"] = builtinQueries.getByRole;
/**
 * Waits for and returns every widget with a matching accessible role and options, retrying until at
 * least one appears or the timeout elapses.
 */
const findAllByRole: BuiltinQueries["findAllByRole"] = builtinQueries.findAllByRole;
/**
 * Waits for and returns the single widget with a matching accessible role and options, retrying
 * until it appears or the timeout elapses. Rejects when none or more than one matches.
 */
const findByRole: BuiltinQueries["findByRole"] = builtinQueries.findByRole;
/**
 * Returns the single widget with matching associated label text, or null when none match.
 * Throws when more than one matches.
 */
const queryByLabelText: BuiltinQueries["queryByLabelText"] = builtinQueries.queryByLabelText;
/** Returns every widget with matching associated label text. Throws when none match. */
const getAllByLabelText: BuiltinQueries["getAllByLabelText"] = builtinQueries.getAllByLabelText;
/** Returns the single widget with matching associated label text. Throws when none or more than one matches. */
const getByLabelText: BuiltinQueries["getByLabelText"] = builtinQueries.getByLabelText;
/**
 * Waits for and returns every widget with matching associated label text, retrying until at least
 * one appears or the timeout elapses.
 */
const findAllByLabelText: BuiltinQueries["findAllByLabelText"] = builtinQueries.findAllByLabelText;
/**
 * Waits for and returns the single widget with matching associated label text, retrying until it
 * appears or the timeout elapses. Rejects when none or more than one matches.
 */
const findByLabelText: BuiltinQueries["findByLabelText"] = builtinQueries.findByLabelText;
/**
 * Returns the single widget with matching rendered text content, or null when none match.
 * Throws when more than one matches.
 */
const queryByText: BuiltinQueries["queryByText"] = builtinQueries.queryByText;
/** Returns every widget with matching rendered text content. Throws when none match. */
const getAllByText: BuiltinQueries["getAllByText"] = builtinQueries.getAllByText;
/** Returns the single widget with matching rendered text content. Throws when none or more than one matches. */
const getByText: BuiltinQueries["getByText"] = builtinQueries.getByText;
/**
 * Waits for and returns every widget with matching rendered text content, retrying until at least
 * one appears or the timeout elapses.
 */
const findAllByText: BuiltinQueries["findAllByText"] = builtinQueries.findAllByText;
/**
 * Waits for and returns the single widget with matching rendered text content, retrying until it
 * appears or the timeout elapses. Rejects when none or more than one matches.
 */
const findByText: BuiltinQueries["findByText"] = builtinQueries.findByText;
/**
 * Returns the single widget with a matching widget name, or null when none match.
 * Throws when more than one matches.
 */
const queryByName: BuiltinQueries["queryByName"] = builtinQueries.queryByName;
/** Returns every widget with a matching widget name. Throws when none match. */
const getAllByName: BuiltinQueries["getAllByName"] = builtinQueries.getAllByName;
/** Returns the single widget with a matching widget name. Throws when none or more than one matches. */
const getByName: BuiltinQueries["getByName"] = builtinQueries.getByName;
/**
 * Waits for and returns every widget with a matching widget name, retrying until at least one
 * appears or the timeout elapses.
 */
const findAllByName: BuiltinQueries["findAllByName"] = builtinQueries.findAllByName;
/**
 * Waits for and returns the single widget with a matching widget name, retrying until it appears or
 * the timeout elapses. Rejects when none or more than one matches.
 */
const findByName: BuiltinQueries["findByName"] = builtinQueries.findByName;
/**
 * Returns the single widget with matching placeholder text, or null when none match.
 * Throws when more than one matches.
 */
const queryByPlaceholderText: BuiltinQueries["queryByPlaceholderText"] = builtinQueries.queryByPlaceholderText;
/** Returns every widget with matching placeholder text. Throws when none match. */
const getAllByPlaceholderText: BuiltinQueries["getAllByPlaceholderText"] = builtinQueries.getAllByPlaceholderText;
/** Returns the single widget with matching placeholder text. Throws when none or more than one matches. */
const getByPlaceholderText: BuiltinQueries["getByPlaceholderText"] = builtinQueries.getByPlaceholderText;
/**
 * Waits for and returns every widget with matching placeholder text, retrying until at least one
 * appears or the timeout elapses.
 */
const findAllByPlaceholderText: BuiltinQueries["findAllByPlaceholderText"] = builtinQueries.findAllByPlaceholderText;
/**
 * Waits for and returns the single widget with matching placeholder text, retrying until it appears
 * or the timeout elapses. Rejects when none or more than one matches.
 */
const findByPlaceholderText: BuiltinQueries["findByPlaceholderText"] = builtinQueries.findByPlaceholderText;
/**
 * Returns the single widget with a matching display value, or null when none match.
 * Throws when more than one matches.
 */
const queryByDisplayValue: BuiltinQueries["queryByDisplayValue"] = builtinQueries.queryByDisplayValue;
/** Returns every widget with a matching display value. Throws when none match. */
const getAllByDisplayValue: BuiltinQueries["getAllByDisplayValue"] = builtinQueries.getAllByDisplayValue;
/** Returns the single widget with a matching display value. Throws when none or more than one matches. */
const getByDisplayValue: BuiltinQueries["getByDisplayValue"] = builtinQueries.getByDisplayValue;
/**
 * Waits for and returns every widget with a matching display value, retrying until at least one
 * appears or the timeout elapses.
 */
const findAllByDisplayValue: BuiltinQueries["findAllByDisplayValue"] = builtinQueries.findAllByDisplayValue;
/**
 * Waits for and returns the single widget with a matching display value, retrying until it appears
 * or the timeout elapses. Rejects when none or more than one matches.
 */
const findByDisplayValue: BuiltinQueries["findByDisplayValue"] = builtinQueries.findByDisplayValue;

/**
 * Builds the default text normalizer, which optionally trims surrounding whitespace and collapses
 * runs of whitespace into single spaces.
 * @param options Toggles for trimming and whitespace collapsing.
 * @returns A function that normalizes a string for comparison against a matcher.
 */
const getDefaultNormalizer = ({
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

const isNumericValueMatch = (expected: number | undefined, actual: number | null): boolean =>
    expected === undefined || actual === expected;

const hasMatchingAccessibleValue = (widget: Gtk.Widget, value: ByRoleValue, options: ByRoleOptions): boolean => {
    const actual = getWidgetValue(widget);

    const numericChecks: [number | undefined, number | null][] = [
        [value.now, actual.now],
        [value.min, actual.min],
        [value.max, actual.max],
    ];

    for (const [expected, current] of numericChecks) {
        if (!isNumericValueMatch(expected, current)) {
            return false;
        }
    }

    return value.text === undefined || isTextMatch(actual.text, value.text, widget, options);
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
    return {
        [`queryBy${suffix}`]: built.queryBy,
        [`queryAllBy${suffix}`]: queryAllBy,
        [`getBy${suffix}`]: built.getBy,
        [`getAllBy${suffix}`]: built.getAllBy,
        [`findBy${suffix}`]: built.findBy,
        [`findAllBy${suffix}`]: built.findAllBy,
    };
}

/**
 * Finds every widget under the container whose accessible role matches `role` and that satisfies the given options.
 * Widgets excluded from the accessibility tree are skipped unless `options.hidden` is set.
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

    const labelText = widget.getLabel();

    if (!labelText || !isTextMatch(labelText, text, widget, options)) {
        return null;
    }

    return widget.getMnemonicWidget();
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

    const ownLabel = getWidgetOwnLabel(widget);

    if (ownLabel !== null && isTextMatch(ownLabel, text, widget, options)) {
        results.add(widget);
    }

    const labelledByText = getWidgetLabelledByText(widget);

    if (labelledByText !== null && isTextMatch(labelledByText, text, widget, options)) {
        results.add(widget);
    }
};

/**
 * Finds every widget associated with a label whose text matches: a Gtk.Label mnemonic target, the
 * widget's own accessible label, or its labelled-by relation.
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
 * Finds every widget whose rendered text content matches.
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
 * Finds every widget whose widget name matches.
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
 * Finds every widget whose placeholder text matches.
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
 * Finds every widget whose current display value matches.
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
    getDefaultNormalizer,
    queryAllByRole,
    queryAllByLabelText,
    queryAllByText,
    queryAllByName,
    queryAllByPlaceholderText,
    queryAllByDisplayValue,
    type BuiltinQueries,
};
