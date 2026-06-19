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

/**
 * Returns the default text normalizer: it trims leading and trailing whitespace
 * and collapses internal whitespace runs to a single space. Compose it inside a
 * custom `normalizer` to retain the default behavior alongside extra steps.
 *
 * Mirrors `getDefaultNormalizer` from `@testing-library/dom`.
 *
 * @param options - Toggles for `trim` and `collapseWhitespace` (both default to `true`).
 * @returns A normalizer applying the selected transformations.
 *
 * @example
 * ```tsx
 * import { getByText, getDefaultNormalizer } from "@gtkx/testing";
 *
 * getByText(container, "hello", {
 *     normalizer: (text) => getDefaultNormalizer({ trim: false })(text).replace(/ /g, " "),
 * });
 * ```
 */
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

/**
 * Finds all elements matching a role without throwing.
 *
 * @param container - The container to search within
 * @param role - The GTK accessible role to match
 * @param options - Query options including name and state filters
 * @returns Array of matching widgets (empty if none found)
 */
export const queryAllByRole = (container: Container, role: Gtk.AccessibleRole, options?: ByRoleOptions): Gtk.Widget[] =>
    findAll(container, (widget) => {
        if (widget.getAccessibleRole() !== role) return false;
        if (!options?.hidden && isHiddenFromAccessibility(widget)) return false;
        return matchByRoleOptions(widget, options);
    });

const roleVariants = buildQueries<[role: Gtk.AccessibleRole, options?: ByRoleOptions]>(
    queryAllByRole,
    (container, count, role, options) => multipleFoundError(container, { queryType: "role", role, options }, count),
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

/**
 * Finds all elements labeled by matching text, resolving every GTK labeling
 * mechanism: a `GtkLabel`'s mnemonic-widget association, a widget's own
 * `accessibleLabel` (the analog of `accessible-label`), and the widgets named by
 * `accessibleLabelledBy` (the analog of `accessible-labelledby`).
 *
 * @param container - The container to search within
 * @param text - Label text to match (string, RegExp, or custom matcher)
 * @param options - Query options including normalization
 * @returns Array of labeled widgets (empty if none found)
 */
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
    queryAllByLabelText,
    (container, count, text) => multipleFoundError(container, { queryType: "labelText", text }, count),
    (container, text) => notFoundError(container, { queryType: "labelText", text }),
);

/**
 * Finds all elements matching text content without throwing.
 *
 * @param container - The container to search within
 * @param text - Text to match (string, RegExp, or custom matcher)
 * @param options - Query options including normalization
 * @returns Array of matching widgets (empty if none found)
 */
export const queryAllByText = (container: Container, text: Matcher, options?: MatcherOptions): Gtk.Widget[] =>
    findAll(container, (widget) => matchText(getWidgetText(widget), text, widget, options));

const textVariants = buildQueries<[text: Matcher, options?: MatcherOptions]>(
    queryAllByText,
    (container, count, text) => multipleFoundError(container, { queryType: "text", text }, count),
    (container, text) => notFoundError(container, { queryType: "text", text }),
);

/**
 * Finds all elements matching a widget name without throwing.
 *
 * @param container - The container to search within
 * @param name - Widget name to match (string, RegExp, or custom matcher)
 * @param options - Query options including normalization
 * @returns Array of matching widgets (empty if none found)
 */
export const queryAllByName = (container: Container, name: Matcher, options?: MatcherOptions): Gtk.Widget[] =>
    findAll(container, (widget) => matchText(getWidgetName(widget), name, widget, options));

const nameVariants = buildQueries<[name: Matcher, options?: MatcherOptions]>(
    queryAllByName,
    (container, count, name) => multipleFoundError(container, { queryType: "name", name }, count),
    (container, name) => notFoundError(container, { queryType: "name", name }),
);

/** Finds a single element matching a role without throwing. Returns `null` if not found; throws if multiple match. */
export const queryByRole: BuiltQueries<[role: Gtk.AccessibleRole, options?: ByRoleOptions]>["queryBy"] =
    roleVariants.queryBy;
/** Finds a single element matching a role. Throws if not found or if multiple match. */
export const getByRole: BuiltQueries<[role: Gtk.AccessibleRole, options?: ByRoleOptions]>["getBy"] = roleVariants.getBy;
/** Finds all elements matching a role. Throws if none found. */
export const getAllByRole: BuiltQueries<[role: Gtk.AccessibleRole, options?: ByRoleOptions]>["getAllBy"] =
    roleVariants.getAllBy;
/** Finds a single element matching a role, waiting until it appears. Throws if not found or if multiple match. */
export const findByRole: BuiltQueries<[role: Gtk.AccessibleRole, options?: ByRoleOptions]>["findBy"] =
    roleVariants.findBy;
/** Finds all elements matching a role, waiting until any appear. Throws if none found. */
export const findAllByRole: BuiltQueries<[role: Gtk.AccessibleRole, options?: ByRoleOptions]>["findAllBy"] =
    roleVariants.findAllBy;

/** Finds a single element by label text without throwing. Returns `null` if not found; throws if multiple match. */
export const queryByLabelText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["queryBy"] =
    labelTextVariants.queryBy;
/** Finds a single element by label text. Throws if not found or if multiple match. */
export const getByLabelText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["getBy"] = labelTextVariants.getBy;
/** Finds all elements matching label text. Throws if none found. */
export const getAllByLabelText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["getAllBy"] =
    labelTextVariants.getAllBy;
/** Finds a single element by label text, waiting until it appears. Throws if not found or if multiple match. */
export const findByLabelText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["findBy"] =
    labelTextVariants.findBy;
/** Finds all elements matching label text, waiting until any appear. Throws if none found. */
export const findAllByLabelText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["findAllBy"] =
    labelTextVariants.findAllBy;

/** Finds a single element by visible text without throwing. Returns `null` if not found; throws if multiple match. */
export const queryByText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["queryBy"] = textVariants.queryBy;
/** Finds a single element by visible text. Throws if not found or if multiple match. */
export const getByText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["getBy"] = textVariants.getBy;
/** Finds all elements matching visible text. Throws if none found. */
export const getAllByText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["getAllBy"] = textVariants.getAllBy;
/** Finds a single element by visible text, waiting until it appears. Throws if not found or if multiple match. */
export const findByText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["findBy"] = textVariants.findBy;
/** Finds all elements matching visible text, waiting until any appear. Throws if none found. */
export const findAllByText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["findAllBy"] =
    textVariants.findAllBy;

/** Finds a single element by widget name without throwing. Returns `null` if not found; throws if multiple match. */
export const queryByName: BuiltQueries<[name: Matcher, options?: MatcherOptions]>["queryBy"] = nameVariants.queryBy;
/** Finds a single element by widget name. Throws if not found or if multiple match. */
export const getByName: BuiltQueries<[name: Matcher, options?: MatcherOptions]>["getBy"] = nameVariants.getBy;
/** Finds all elements matching a widget name. Throws if none found. */
export const getAllByName: BuiltQueries<[name: Matcher, options?: MatcherOptions]>["getAllBy"] = nameVariants.getAllBy;
/** Finds a single element by widget name, waiting until it appears. Throws if not found or if multiple match. */
export const findByName: BuiltQueries<[name: Matcher, options?: MatcherOptions]>["findBy"] = nameVariants.findBy;
/** Finds all elements matching a widget name, waiting until any appear. Throws if none found. */
export const findAllByName: BuiltQueries<[name: Matcher, options?: MatcherOptions]>["findAllBy"] =
    nameVariants.findAllBy;

/**
 * Finds all entry-like widgets whose placeholder text matches, without throwing.
 *
 * @param container - The container to search within
 * @param text - Placeholder text to match (string, RegExp, or custom matcher)
 * @param options - Query options including normalization
 * @returns Array of matching widgets (empty if none found)
 */
export const queryAllByPlaceholderText = (
    container: Container,
    text: Matcher,
    options?: MatcherOptions,
): Gtk.Widget[] => findAll(container, (widget) => matchText(getWidgetPlaceholderText(widget), text, widget, options));

const placeholderTextVariants = buildQueries<[text: Matcher, options?: MatcherOptions]>(
    queryAllByPlaceholderText,
    (container, count, text) => multipleFoundError(container, { queryType: "placeholderText", text }, count),
    (container, text) => notFoundError(container, { queryType: "placeholderText", text }),
);

/**
 * Finds all input widgets whose current display value matches, without throwing.
 *
 * @param container - The container to search within
 * @param value - Value to match (string, RegExp, or custom matcher)
 * @param options - Query options including normalization
 * @returns Array of matching widgets (empty if none found)
 */
export const queryAllByDisplayValue = (container: Container, value: Matcher, options?: MatcherOptions): Gtk.Widget[] =>
    findAll(container, (widget) => matchText(getWidgetDisplayValue(widget), value, widget, options));

const displayValueVariants = buildQueries<[value: Matcher, options?: MatcherOptions]>(
    queryAllByDisplayValue,
    (container, count, value) => multipleFoundError(container, { queryType: "displayValue", value }, count),
    (container, value) => notFoundError(container, { queryType: "displayValue", value }),
);

/** Finds a single element by placeholder text without throwing. Returns `null` if not found; throws if multiple match. */
export const queryByPlaceholderText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["queryBy"] =
    placeholderTextVariants.queryBy;
/** Finds a single element by placeholder text. Throws if not found or if multiple match. */
export const getByPlaceholderText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["getBy"] =
    placeholderTextVariants.getBy;
/** Finds all elements matching placeholder text. Throws if none found. */
export const getAllByPlaceholderText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["getAllBy"] =
    placeholderTextVariants.getAllBy;
/** Finds a single element by placeholder text, waiting until it appears. Throws if not found or if multiple match. */
export const findByPlaceholderText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["findBy"] =
    placeholderTextVariants.findBy;
/** Finds all elements matching placeholder text, waiting until any appear. Throws if none found. */
export const findAllByPlaceholderText: BuiltQueries<[text: Matcher, options?: MatcherOptions]>["findAllBy"] =
    placeholderTextVariants.findAllBy;

/** Finds a single element by display value without throwing. Returns `null` if not found; throws if multiple match. */
export const queryByDisplayValue: BuiltQueries<[value: Matcher, options?: MatcherOptions]>["queryBy"] =
    displayValueVariants.queryBy;
/** Finds a single element by display value. Throws if not found or if multiple match. */
export const getByDisplayValue: BuiltQueries<[value: Matcher, options?: MatcherOptions]>["getBy"] =
    displayValueVariants.getBy;
/** Finds all elements matching a display value. Throws if none found. */
export const getAllByDisplayValue: BuiltQueries<[value: Matcher, options?: MatcherOptions]>["getAllBy"] =
    displayValueVariants.getAllBy;
/** Finds a single element by display value, waiting until it appears. Throws if not found or if multiple match. */
export const findByDisplayValue: BuiltQueries<[value: Matcher, options?: MatcherOptions]>["findBy"] =
    displayValueVariants.findBy;
/** Finds all elements matching a display value, waiting until any appear. Throws if none found. */
export const findAllByDisplayValue: BuiltQueries<[value: Matcher, options?: MatcherOptions]>["findAllBy"] =
    displayValueVariants.findAllBy;
