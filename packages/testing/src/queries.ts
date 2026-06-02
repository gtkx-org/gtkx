import * as Gtk from "@gtkx/gi/gtk";
import { multipleFoundError, notFoundError } from "./errors.js";
import { buildQueries } from "./query-helpers.js";
import { type Container, findAll, traverse } from "./traversal.js";
import type { ByRoleOptions, Matcher, MatcherOptions } from "./types.js";
import {
    getWidgetAccessibleName,
    getWidgetCheckedState,
    getWidgetExpandedState,
    getWidgetLevel,
    getWidgetName,
    getWidgetPressedState,
    getWidgetSelectedState,
    getWidgetText,
} from "./widget-text.js";

const buildNormalizer = (options?: MatcherOptions): ((text: string) => string) => {
    if (options?.normalizer) {
        return options.normalizer;
    }

    const trim = options?.trim ?? true;
    const collapseWhitespace = options?.collapseWhitespace ?? true;

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

    const normalizedExpected = normalizeText(expected, options);
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

const matchAccessibleStates = (widget: Gtk.Widget, options: ByRoleOptions): boolean => {
    if (options.checked !== undefined && getWidgetCheckedState(widget) !== options.checked) return false;
    if (options.pressed !== undefined && getWidgetPressedState(widget) !== options.pressed) return false;
    if (options.expanded !== undefined && getWidgetExpandedState(widget) !== options.expanded) return false;
    if (options.selected !== undefined && getWidgetSelectedState(widget) !== options.selected) return false;
    if (options.level !== undefined && getWidgetLevel(widget) !== options.level) return false;
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
        return matchByRoleOptions(widget, options);
    });

const roleVariants = buildQueries<[role: Gtk.AccessibleRole, options?: ByRoleOptions]>(
    queryAllByRole,
    (container, count, role, options) => multipleFoundError(container, "role", { role, options }, count),
    (container, role, options) => notFoundError(container, "role", { role, options }),
);

/**
 * Finds all elements that are labeled by a GtkLabel whose text matches.
 *
 * Uses GtkLabel's mnemonic widget association to find form elements
 * by their label text.
 *
 * @param container - The container to search within
 * @param text - Label text to match (string, RegExp, or custom matcher)
 * @param options - Query options including normalization
 * @returns Array of labeled widgets (empty if none found)
 */
export const queryAllByLabelText = (container: Container, text: Matcher, options?: MatcherOptions): Gtk.Widget[] => {
    const results: Gtk.Widget[] = [];

    for (const widget of traverse(container)) {
        if (!(widget instanceof Gtk.Label)) continue;

        const labelText = widget.getLabel();
        if (!labelText) continue;
        if (!matchText(labelText, text, widget, options)) continue;

        const target = widget.getMnemonicWidget();
        if (target) {
            results.push(target);
        }
    }

    return results;
};

const labelTextVariants = buildQueries<[text: Matcher, options?: MatcherOptions]>(
    queryAllByLabelText,
    (container, count, text, options) => multipleFoundError(container, "labelText", { text, options }, count),
    (container, text, options) => notFoundError(container, "labelText", { text, options }),
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
    (container, count, text, options) => multipleFoundError(container, "text", { text, options }, count),
    (container, text, options) => notFoundError(container, "text", { text, options }),
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
    (container, count, name, options) => multipleFoundError(container, "name", { name, options }, count),
    (container, name, options) => notFoundError(container, "name", { name, options }),
);

/** Finds a single element matching a role without throwing. Returns `null` if not found; throws if multiple match. */
export const queryByRole = roleVariants.queryBy;
/** Finds a single element matching a role. Throws if not found or if multiple match. */
export const getByRole = roleVariants.getBy;
/** Finds all elements matching a role. Throws if none found. */
export const getAllByRole = roleVariants.getAllBy;
/** Finds a single element matching a role, waiting until it appears. Throws if not found or if multiple match. */
export const findByRole = roleVariants.findBy;
/** Finds all elements matching a role, waiting until any appear. Throws if none found. */
export const findAllByRole = roleVariants.findAllBy;

/** Finds a single element by label text without throwing. Returns `null` if not found; throws if multiple match. */
export const queryByLabelText = labelTextVariants.queryBy;
/** Finds a single element by label text. Throws if not found or if multiple match. */
export const getByLabelText = labelTextVariants.getBy;
/** Finds all elements matching label text. Throws if none found. */
export const getAllByLabelText = labelTextVariants.getAllBy;
/** Finds a single element by label text, waiting until it appears. Throws if not found or if multiple match. */
export const findByLabelText = labelTextVariants.findBy;
/** Finds all elements matching label text, waiting until any appear. Throws if none found. */
export const findAllByLabelText = labelTextVariants.findAllBy;

/** Finds a single element by visible text without throwing. Returns `null` if not found; throws if multiple match. */
export const queryByText = textVariants.queryBy;
/** Finds a single element by visible text. Throws if not found or if multiple match. */
export const getByText = textVariants.getBy;
/** Finds all elements matching visible text. Throws if none found. */
export const getAllByText = textVariants.getAllBy;
/** Finds a single element by visible text, waiting until it appears. Throws if not found or if multiple match. */
export const findByText = textVariants.findBy;
/** Finds all elements matching visible text, waiting until any appear. Throws if none found. */
export const findAllByText = textVariants.findAllBy;

/** Finds a single element by widget name without throwing. Returns `null` if not found; throws if multiple match. */
export const queryByName = nameVariants.queryBy;
/** Finds a single element by widget name. Throws if not found or if multiple match. */
export const getByName = nameVariants.getBy;
/** Finds all elements matching a widget name. Throws if none found. */
export const getAllByName = nameVariants.getAllBy;
/** Finds a single element by widget name, waiting until it appears. Throws if not found or if multiple match. */
export const findByName = nameVariants.findBy;
/** Finds all elements matching a widget name, waiting until any appear. Throws if none found. */
export const findAllByName = nameVariants.findAllBy;
