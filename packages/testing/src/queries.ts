import { getNativeObject } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import { findAll } from "./traversal.js";
import type { ByRoleOptions, TextMatch, TextMatchOptions } from "./types.js";
import { waitFor } from "./wait-for.js";

type Container = Gtk.Application | Gtk.Widget;

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
    return exact ? normalizedActual === normalizedExpected : normalizedActual.includes(normalizedExpected);
};

const ROLES_WITH_INTERNAL_LABELS = new Set([
    Gtk.AccessibleRole.BUTTON,
    Gtk.AccessibleRole.TOGGLE_BUTTON,
    Gtk.AccessibleRole.CHECKBOX,
    Gtk.AccessibleRole.RADIO,
    Gtk.AccessibleRole.MENU_ITEM,
    Gtk.AccessibleRole.MENU_ITEM_CHECKBOX,
    Gtk.AccessibleRole.MENU_ITEM_RADIO,
    Gtk.AccessibleRole.TAB,
    Gtk.AccessibleRole.LINK,
]);

const isInternalLabel = (widget: Gtk.Widget): boolean => {
    const accessible = getNativeObject(widget.id, Gtk.Accessible);
    if (!accessible || accessible.getAccessibleRole() !== Gtk.AccessibleRole.LABEL) return false;

    const parent = widget.getParent();
    if (!parent) return false;

    const parentAccessible = getNativeObject(parent.id, Gtk.Accessible);
    if (!parentAccessible) return false;

    return ROLES_WITH_INTERNAL_LABELS.has(parentAccessible.getAccessibleRole());
};

const getLabelText = (widget: Gtk.Widget): string | null => {
    const asLabel = widget as Gtk.Label;
    const asInscription = widget as Gtk.Inscription;
    return asLabel.getLabel?.() ?? asInscription.getText?.() ?? null;
};

const collectChildLabels = (widget: Gtk.Widget): string[] => {
    const labels: string[] = [];
    let child = widget.getFirstChild();

    while (child) {
        const childAccessible = getNativeObject(child.id, Gtk.Accessible);
        if (childAccessible?.getAccessibleRole() === Gtk.AccessibleRole.LABEL) {
            const labelText = getLabelText(child);
            if (labelText) labels.push(labelText);
        }

        labels.push(...collectChildLabels(child));
        child = child.getNextSibling();
    }

    return labels;
};

const getWidgetText = (widget: Gtk.Widget): string | null => {
    if (isInternalLabel(widget)) return null;

    const role = getNativeObject(widget.id, Gtk.Accessible)?.getAccessibleRole();
    if (role === undefined) return null;

    switch (role) {
        case Gtk.AccessibleRole.BUTTON:
        case Gtk.AccessibleRole.LINK:
        case Gtk.AccessibleRole.TAB: {
            const directLabel =
                (widget as Gtk.Button).getLabel?.() ??
                (widget as Gtk.MenuButton).getLabel?.() ??
                (widget as Gtk.Expander).getLabel?.();
            if (directLabel) return directLabel;

            const childLabels = collectChildLabels(widget);
            return childLabels.length > 0 ? childLabels.join(" ") : null;
        }
        case Gtk.AccessibleRole.TOGGLE_BUTTON:
            return (widget as Gtk.ToggleButton).getLabel?.() ?? null;
        case Gtk.AccessibleRole.CHECKBOX:
        case Gtk.AccessibleRole.RADIO:
            return (widget as Gtk.CheckButton).getLabel?.() ?? null;
        case Gtk.AccessibleRole.LABEL:
            return getLabelText(widget);
        case Gtk.AccessibleRole.TEXT_BOX:
        case Gtk.AccessibleRole.SEARCH_BOX:
        case Gtk.AccessibleRole.SPIN_BUTTON:
            return getNativeObject(widget.id, Gtk.Editable)?.getText() ?? null;
        case Gtk.AccessibleRole.GROUP:
            return (widget as Gtk.Frame).getLabel?.() ?? null;
        case Gtk.AccessibleRole.WINDOW:
        case Gtk.AccessibleRole.DIALOG:
        case Gtk.AccessibleRole.ALERT_DIALOG:
            return (widget as Gtk.Window).getTitle() ?? null;
        case Gtk.AccessibleRole.TAB_PANEL: {
            const parent = widget.getParent();
            if (parent) {
                const stack = parent as Gtk.Stack;
                const page = stack.getPage?.(widget);
                if (page) {
                    return page.getTitle() ?? null;
                }
            }
            return null;
        }
        default:
            return null;
    }
};

const getWidgetTestId = (widget: Gtk.Widget): string | null => {
    return widget.getName();
};

const getWidgetCheckedState = (widget: Gtk.Widget): boolean | null => {
    const accessible = getNativeObject(widget.id, Gtk.Accessible);
    if (!accessible) return null;

    const role = accessible.getAccessibleRole();

    switch (role) {
        case Gtk.AccessibleRole.CHECKBOX:
        case Gtk.AccessibleRole.RADIO:
            return (widget as Gtk.CheckButton).getActive();
        case Gtk.AccessibleRole.TOGGLE_BUTTON:
            return (widget as Gtk.ToggleButton).getActive();
        case Gtk.AccessibleRole.SWITCH:
            return (widget as Gtk.Switch).getActive();
        default:
            return null;
    }
};

const getWidgetExpandedState = (widget: Gtk.Widget): boolean | null => {
    const accessible = getNativeObject(widget.id, Gtk.Accessible);
    if (!accessible) return null;

    const role = accessible.getAccessibleRole();

    if (role === Gtk.AccessibleRole.BUTTON) {
        const parent = widget.getParent();
        if (!parent) return null;
        return (parent as Gtk.Expander).getExpanded?.() ?? null;
    }

    return null;
};

const matchByRoleOptions = (widget: Gtk.Widget, options?: ByRoleOptions): boolean => {
    if (!options) return true;

    if (options.name !== undefined) {
        const text = getWidgetText(widget);
        if (!matchText(text, options.name, widget, options)) return false;
    }

    if (options.checked !== undefined) {
        const checked = getWidgetCheckedState(widget);
        if (checked !== options.checked) return false;
    }

    if (options.expanded !== undefined) {
        const expanded = getWidgetExpandedState(widget);
        if (expanded !== options.expanded) return false;
    }

    return true;
};

const formatRole = (role: Gtk.AccessibleRole): string => Gtk.AccessibleRole[role] ?? String(role);

const formatByRoleError = (role: Gtk.AccessibleRole, options?: ByRoleOptions): string => {
    const parts = [`role '${formatRole(role)}'`];
    if (options?.name) parts.push(`name '${options.name}'`);
    if (options?.checked !== undefined) parts.push(`checked=${options.checked}`);
    if (options?.pressed !== undefined) parts.push(`pressed=${options.pressed}`);
    if (options?.selected !== undefined) parts.push(`selected=${options.selected}`);
    if (options?.expanded !== undefined) parts.push(`expanded=${options.expanded}`);
    if (options?.level !== undefined) parts.push(`level=${options.level}`);
    return parts.join(" and ");
};

const getAllByRole = (container: Container, role: Gtk.AccessibleRole, options?: ByRoleOptions): Gtk.Widget[] => {
    const matches = findAll(container, (node) => {
        const accessible = getNativeObject(node.id, Gtk.Accessible);
        if (!accessible || accessible.getAccessibleRole() !== role) return false;
        return matchByRoleOptions(node, options);
    });

    if (matches.length === 0) {
        throw new Error(`Unable to find any elements with ${formatByRoleError(role, options)}`);
    }
    return matches;
};

const getByRole = (container: Container, role: Gtk.AccessibleRole, options?: ByRoleOptions): Gtk.Widget => {
    const matches = getAllByRole(container, role, options);

    if (matches.length > 1) {
        throw new Error(`Expected 1 element with ${formatByRoleError(role, options)}, found ${matches.length}`);
    }
    const [first] = matches;
    if (!first) throw new Error(`Unable to find element with ${formatByRoleError(role, options)}`);
    return first;
};

const getAllByLabelText = (container: Container, text: TextMatch, options?: TextMatchOptions): Gtk.Widget[] => {
    const matches = findAll(container, (node) => {
        const widgetText = getWidgetText(node);
        return matchText(widgetText, text, node, options);
    });

    if (matches.length === 0) {
        throw new Error(`Unable to find any elements with label text '${text}'`);
    }

    return matches;
};

const getByLabelText = (container: Container, text: TextMatch, options?: TextMatchOptions): Gtk.Widget => {
    const matches = getAllByLabelText(container, text, options);

    if (matches.length > 1) {
        throw new Error(`Expected 1 element with label text '${text}', found ${matches.length}`);
    }

    const [first] = matches;
    if (!first) throw new Error(`Unable to find element with label text '${text}'`);
    return first;
};

const getAllByText = (container: Container, text: TextMatch, options?: TextMatchOptions): Gtk.Widget[] => {
    const matches = findAll(container, (node) => {
        const widgetText = getWidgetText(node);
        return matchText(widgetText, text, node, options);
    });

    if (matches.length === 0) {
        throw new Error(`Unable to find any elements with text '${text}'`);
    }

    return matches;
};

const getByText = (container: Container, text: TextMatch, options?: TextMatchOptions): Gtk.Widget => {
    const matches = getAllByText(container, text, options);

    if (matches.length > 1) {
        throw new Error(`Expected 1 element with text '${text}', found ${matches.length}`);
    }

    const [first] = matches;
    if (!first) throw new Error(`Unable to find element with text '${text}'`);
    return first;
};

const getAllByTestId = (container: Container, testId: TextMatch, options?: TextMatchOptions): Gtk.Widget[] => {
    const matches = findAll(container, (node) => {
        const widgetTestId = getWidgetTestId(node);
        return matchText(widgetTestId, testId, node, options);
    });

    if (matches.length === 0) {
        throw new Error(`Unable to find any elements with test id '${testId}'`);
    }

    return matches;
};

const getByTestId = (container: Container, testId: TextMatch, options?: TextMatchOptions): Gtk.Widget => {
    const matches = getAllByTestId(container, testId, options);

    if (matches.length > 1) {
        throw new Error(`Expected 1 element with test id '${testId}', found ${matches.length}`);
    }

    const [first] = matches;
    if (!first) throw new Error(`Unable to find element with test id '${testId}'`);
    return first;
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
 * Finds a single element by its label or text content.
 *
 * Matches button labels, input placeholders, window titles, and other
 * accessible text content.
 *
 * @param container - The container to search within
 * @param text - Text to match (string, RegExp, or custom matcher)
 * @param options - Query options including normalization and timeout
 * @returns Promise resolving to the matching widget
 *
 * @example
 * ```tsx
 * const button = await findByLabelText(container, "Click me");
 * const input = await findByLabelText(container, /search/i);
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
