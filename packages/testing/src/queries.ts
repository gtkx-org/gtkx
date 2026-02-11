import * as Gtk from "@gtkx/ffi/gtk";
import { buildMultipleFoundError, buildNotFoundError } from "./error-builder.js";
import { type Container, findAll, traverse } from "./traversal.js";
import type { ByRoleOptions, TextMatch, TextMatchOptions } from "./types.js";
import { waitFor } from "./wait-for.js";
import {
    getWidgetAccessibleName,
    getWidgetCheckedState,
    getWidgetExpandedState,
    getWidgetPressedState,
    getWidgetSelectedState,
    getWidgetTestId,
    getWidgetText,
} from "./widget-text.js";

const buildNormalizer = (options?: TextMatchOptions): ((text: string) => string) => {
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
            result = result.replace(/\s+/g, " ");
        }

        return result;
    };
};

const normalizeText = (text: string, options?: TextMatchOptions): string => {
    const normalizer = buildNormalizer(options);
    return normalizer(text);
};

const matchText = (
    actual: string | null,
    expected: TextMatch,
    widget: Gtk.Widget,
    options?: TextMatchOptions,
): boolean => {
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

const matchByRoleOptions = (widget: Gtk.Widget, options?: ByRoleOptions): boolean => {
    if (!options) return true;

    if (options.name !== undefined) {
        const text = getWidgetAccessibleName(widget);
        if (!matchText(text, options.name, widget, options)) return false;
    }

    if (options.checked !== undefined) {
        const checked = getWidgetCheckedState(widget);
        if (checked !== options.checked) return false;
    }

    if (options.pressed !== undefined) {
        const pressed = getWidgetPressedState(widget);
        if (pressed !== options.pressed) return false;
    }

    if (options.expanded !== undefined) {
        const expanded = getWidgetExpandedState(widget);
        if (expanded !== options.expanded) return false;
    }

    if (options.selected !== undefined) {
        const selected = getWidgetSelectedState(widget);
        if (selected !== options.selected) return false;
    }

    return true;
};

/**
 * Finds all elements matching a role without throwing.
 *
 * @param container - The container to search within
 * @param role - The GTK accessible role to match
 * @param options - Query options including name and state filters
 * @returns Array of matching widgets (empty if none found)
 */
export const queryAllByRole = (
    container: Container,
    role: Gtk.AccessibleRole,
    options?: ByRoleOptions,
): Gtk.Widget[] => {
    return findAll(container, (node) => {
        if (node.getAccessibleRole() !== role) return false;
        return matchByRoleOptions(node, options);
    });
};

/**
 * Finds a single element matching a role without throwing.
 *
 * @param container - The container to search within
 * @param role - The GTK accessible role to match
 * @param options - Query options including name and state filters
 * @returns The matching widget or null if not found
 * @throws Error if multiple elements match
 */
export const queryByRole = (
    container: Container,
    role: Gtk.AccessibleRole,
    options?: ByRoleOptions,
): Gtk.Widget | null => {
    const matches = queryAllByRole(container, role, options);

    if (matches.length > 1) {
        throw buildMultipleFoundError(container, "role", { role, options }, matches.length);
    }

    return matches[0] ?? null;
};

/**
 * Finds all elements that are labelled by a GtkLabel whose text matches.
 *
 * Uses GtkLabel's mnemonic widget association to find form elements
 * by their label text. Only returns widgets that are properly labelled
 * via GtkLabel's mnemonic-widget property.
 *
 * @param container - The container to search within
 * @param text - Label text to match (string, RegExp, or custom matcher)
 * @param options - Query options including normalization
 * @returns Array of labelled widgets (empty if none found)
 */
export const queryAllByLabelText = (
    container: Container,
    text: TextMatch,
    options?: TextMatchOptions,
): Gtk.Widget[] => {
    const results: Gtk.Widget[] = [];

    for (const node of traverse(container)) {
        if (!(node instanceof Gtk.Label)) continue;

        const labelText = node.getLabel();
        if (!labelText) continue;
        if (!matchText(labelText, text, node, options)) continue;

        const target = node.getMnemonicWidget();
        if (target) {
            results.push(target);
        }
    }

    return results;
};

/**
 * Finds a single element matching label text without throwing.
 *
 * @param container - The container to search within
 * @param text - Text to match (string, RegExp, or custom matcher)
 * @param options - Query options including normalization
 * @returns The matching widget or null if not found
 * @throws Error if multiple elements match
 */
export const queryByLabelText = (
    container: Container,
    text: TextMatch,
    options?: TextMatchOptions,
): Gtk.Widget | null => {
    const matches = queryAllByLabelText(container, text, options);

    if (matches.length > 1) {
        throw buildMultipleFoundError(container, "labelText", { text, options }, matches.length);
    }

    return matches[0] ?? null;
};

/**
 * Finds all elements matching text content without throwing.
 *
 * @param container - The container to search within
 * @param text - Text to match (string, RegExp, or custom matcher)
 * @param options - Query options including normalization
 * @returns Array of matching widgets (empty if none found)
 */
export const queryAllByText = (container: Container, text: TextMatch, options?: TextMatchOptions): Gtk.Widget[] => {
    return findAll(container, (node) => {
        return matchText(getWidgetText(node), text, node, options);
    });
};

/**
 * Finds a single element matching text content without throwing.
 *
 * @param container - The container to search within
 * @param text - Text to match (string, RegExp, or custom matcher)
 * @param options - Query options including normalization
 * @returns The matching widget or null if not found
 * @throws Error if multiple elements match
 */
export const queryByText = (container: Container, text: TextMatch, options?: TextMatchOptions): Gtk.Widget | null => {
    const matches = queryAllByText(container, text, options);

    if (matches.length > 1) {
        throw buildMultipleFoundError(container, "text", { text, options }, matches.length);
    }

    return matches[0] ?? null;
};

/**
 * Finds all elements matching a test ID without throwing.
 *
 * @param container - The container to search within
 * @param testId - Test ID to match (string, RegExp, or custom matcher)
 * @param options - Query options including normalization
 * @returns Array of matching widgets (empty if none found)
 */
export const queryAllByTestId = (container: Container, testId: TextMatch, options?: TextMatchOptions): Gtk.Widget[] => {
    return findAll(container, (node) => {
        const widgetTestId = getWidgetTestId(node);
        return matchText(widgetTestId, testId, node, options);
    });
};

/**
 * Finds a single element matching a test ID without throwing.
 *
 * @param container - The container to search within
 * @param testId - Test ID to match (string, RegExp, or custom matcher)
 * @param options - Query options including normalization
 * @returns The matching widget or null if not found
 * @throws Error if multiple elements match
 */
export const queryByTestId = (
    container: Container,
    testId: TextMatch,
    options?: TextMatchOptions,
): Gtk.Widget | null => {
    const matches = queryAllByTestId(container, testId, options);

    if (matches.length > 1) {
        throw buildMultipleFoundError(container, "testId", { testId, options }, matches.length);
    }

    return matches[0] ?? null;
};

const getAllByRole = (container: Container, role: Gtk.AccessibleRole, options?: ByRoleOptions): Gtk.Widget[] => {
    const matches = queryAllByRole(container, role, options);

    if (matches.length === 0) {
        throw buildNotFoundError(container, "role", { role, options });
    }

    return matches;
};

const getByRole = (container: Container, role: Gtk.AccessibleRole, options?: ByRoleOptions): Gtk.Widget => {
    const matches = getAllByRole(container, role, options);

    if (matches.length > 1) {
        throw buildMultipleFoundError(container, "role", { role, options }, matches.length);
    }

    return matches[0] as Gtk.Widget;
};

const getAllByLabelText = (container: Container, text: TextMatch, options?: TextMatchOptions): Gtk.Widget[] => {
    const matches = queryAllByLabelText(container, text, options);

    if (matches.length === 0) {
        throw buildNotFoundError(container, "labelText", { text, options });
    }

    return matches;
};

const getByLabelText = (container: Container, text: TextMatch, options?: TextMatchOptions): Gtk.Widget => {
    const matches = getAllByLabelText(container, text, options);

    if (matches.length > 1) {
        throw buildMultipleFoundError(container, "labelText", { text, options }, matches.length);
    }

    return matches[0] as Gtk.Widget;
};

const getAllByText = (container: Container, text: TextMatch, options?: TextMatchOptions): Gtk.Widget[] => {
    const matches = queryAllByText(container, text, options);

    if (matches.length === 0) {
        throw buildNotFoundError(container, "text", { text, options });
    }

    return matches;
};

const getByText = (container: Container, text: TextMatch, options?: TextMatchOptions): Gtk.Widget => {
    const matches = getAllByText(container, text, options);

    if (matches.length > 1) {
        throw buildMultipleFoundError(container, "text", { text, options }, matches.length);
    }

    return matches[0] as Gtk.Widget;
};

const getAllByTestId = (container: Container, testId: TextMatch, options?: TextMatchOptions): Gtk.Widget[] => {
    const matches = queryAllByTestId(container, testId, options);

    if (matches.length === 0) {
        throw buildNotFoundError(container, "testId", { testId, options });
    }

    return matches;
};

const getByTestId = (container: Container, testId: TextMatch, options?: TextMatchOptions): Gtk.Widget => {
    const matches = getAllByTestId(container, testId, options);

    if (matches.length > 1) {
        throw buildMultipleFoundError(container, "testId", { testId, options }, matches.length);
    }

    return matches[0] as Gtk.Widget;
};

/**
 * Finds a single element by accessible role.
 *
 * Waits for the element to appear, throwing if not found within timeout.
 *
 * @param container - The container to search within
 * @param role - The GTK accessible role to match
 * @param options - Query options including name, state filters, and timeout
 * @returns Promise resolving to the matching widget
 *
 * @example
 * ```tsx
 * const button = await findByRole(container, Gtk.AccessibleRole.BUTTON, { name: "Submit" });
 * ```
 */
export const findByRole = async (
    container: Container,
    role: Gtk.AccessibleRole,
    options?: ByRoleOptions,
): Promise<Gtk.Widget> =>
    waitFor(() => getByRole(container, role, options), {
        timeout: options?.timeout,
    });

/**
 * Finds all elements matching an accessible role.
 *
 * @param container - The container to search within
 * @param role - The GTK accessible role to match
 * @param options - Query options including name, state filters, and timeout
 * @returns Promise resolving to array of matching widgets
 */
export const findAllByRole = async (
    container: Container,
    role: Gtk.AccessibleRole,
    options?: ByRoleOptions,
): Promise<Gtk.Widget[]> =>
    waitFor(() => getAllByRole(container, role, options), {
        timeout: options?.timeout,
    });

/**
 * Finds a single element that is labelled by a GtkLabel whose text matches.
 *
 * Waits for the element to appear, throwing if not found within timeout.
 * Uses GtkLabel's mnemonic widget association to find form elements.
 *
 * @param container - The container to search within
 * @param text - Label text to match (string, RegExp, or custom matcher)
 * @param options - Query options including normalization and timeout
 * @returns Promise resolving to the labelled widget
 *
 * @example
 * ```tsx
 * const input = await findByLabelText(container, "Username");
 * ```
 */
export const findByLabelText = async (
    container: Container,
    text: TextMatch,
    options?: TextMatchOptions,
): Promise<Gtk.Widget> =>
    waitFor(() => getByLabelText(container, text, options), {
        timeout: options?.timeout,
    });

/**
 * Finds all elements matching label or text content.
 *
 * @param container - The container to search within
 * @param text - Text to match (string, RegExp, or custom matcher)
 * @param options - Query options including normalization and timeout
 * @returns Promise resolving to array of matching widgets
 */
export const findAllByLabelText = async (
    container: Container,
    text: TextMatch,
    options?: TextMatchOptions,
): Promise<Gtk.Widget[]> =>
    waitFor(() => getAllByLabelText(container, text, options), {
        timeout: options?.timeout,
    });

/**
 * Finds a single element by visible text content.
 *
 * Similar to {@link findByLabelText} but focuses on directly visible text.
 *
 * @param container - The container to search within
 * @param text - Text to match (string, RegExp, or custom matcher)
 * @param options - Query options including normalization and timeout
 * @returns Promise resolving to the matching widget
 */
export const findByText = async (
    container: Container,
    text: TextMatch,
    options?: TextMatchOptions,
): Promise<Gtk.Widget> =>
    waitFor(() => getByText(container, text, options), {
        timeout: options?.timeout,
    });

/**
 * Finds all elements matching visible text content.
 *
 * @param container - The container to search within
 * @param text - Text to match (string, RegExp, or custom matcher)
 * @param options - Query options including normalization and timeout
 * @returns Promise resolving to array of matching widgets
 */
export const findAllByText = async (
    container: Container,
    text: TextMatch,
    options?: TextMatchOptions,
): Promise<Gtk.Widget[]> =>
    waitFor(() => getAllByText(container, text, options), {
        timeout: options?.timeout,
    });

/**
 * Finds a single element by test ID (widget name).
 *
 * Uses the widget's `name` property as a test identifier.
 * Set via the `name` prop on GTKX components.
 *
 * @param container - The container to search within
 * @param testId - Test ID to match (string, RegExp, or custom matcher)
 * @param options - Query options including normalization and timeout
 * @returns Promise resolving to the matching widget
 *
 * @example
 * ```tsx
 * // In component: <GtkButton name="submit-btn" />
 * const button = await findByTestId(container, "submit-btn");
 * ```
 */
export const findByTestId = async (
    container: Container,
    testId: TextMatch,
    options?: TextMatchOptions,
): Promise<Gtk.Widget> =>
    waitFor(() => getByTestId(container, testId, options), {
        timeout: options?.timeout,
    });

/**
 * Finds all elements matching a test ID pattern.
 *
 * @param container - The container to search within
 * @param testId - Test ID to match (string, RegExp, or custom matcher)
 * @param options - Query options including normalization and timeout
 * @returns Promise resolving to array of matching widgets
 */
export const findAllByTestId = async (
    container: Container,
    testId: TextMatch,
    options?: TextMatchOptions,
): Promise<Gtk.Widget[]> =>
    waitFor(() => getAllByTestId(container, testId, options), {
        timeout: options?.timeout,
    });
