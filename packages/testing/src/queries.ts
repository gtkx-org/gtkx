import { getInterface } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/ffi/gtk";
import {
    Accessible,
    AccessibleRole,
    Button,
    CheckButton,
    Editable,
    Expander,
    Frame,
    Label,
    MenuButton,
    StackPage,
    Switch,
    ToggleButton,
    Window,
} from "@gtkx/ffi/gtk";
import { findAll } from "./traversal.js";
import type { ByRoleOptions, TextMatchOptions } from "./types.js";
import { waitFor } from "./wait-for.js";

type Container = Gtk.Application | Gtk.Widget;

const DEFAULT_NORMALIZER = (text: string): string => text.trim().replace(/\s+/g, " ");

const normalizeText = (text: string, options?: TextMatchOptions): string => {
    const normalizer = options?.normalizer ?? DEFAULT_NORMALIZER;
    return normalizer(text);
};

const matchText = (actual: string | null, expected: string | RegExp, options?: TextMatchOptions): boolean => {
    if (actual === null) return false;

    const normalizedActual = normalizeText(actual, options);
    const exact = options?.exact ?? true;

    if (typeof expected === "string") {
        const normalizedExpected = normalizeText(expected, options);
        return exact ? normalizedActual === normalizedExpected : normalizedActual.includes(normalizedExpected);
    }
    return expected.test(normalizedActual);
};

const ROLES_WITH_INTERNAL_LABELS = new Set([
    AccessibleRole.BUTTON,
    AccessibleRole.TOGGLE_BUTTON,
    AccessibleRole.CHECKBOX,
    AccessibleRole.RADIO,
    AccessibleRole.MENU_ITEM,
    AccessibleRole.MENU_ITEM_CHECKBOX,
    AccessibleRole.MENU_ITEM_RADIO,
    AccessibleRole.TAB,
    AccessibleRole.LINK,
]);

const isInternalLabel = (widget: Gtk.Widget): boolean => {
    const accessible = getInterface(widget, Accessible);
    if (!accessible || accessible.getAccessibleRole() !== AccessibleRole.LABEL) return false;

    const parent = widget.getParent();
    if (!parent) return false;

    const parentAccessible = getInterface(parent, Accessible);
    if (!parentAccessible) return false;

    return ROLES_WITH_INTERNAL_LABELS.has(parentAccessible.getAccessibleRole());
};

const getWidgetText = (widget: Gtk.Widget): string | null => {
    if (isInternalLabel(widget)) return null;

    const role = getInterface(widget, Accessible)?.getAccessibleRole();
    if (role === undefined) return null;

    switch (role) {
        case AccessibleRole.BUTTON:
        case AccessibleRole.LINK:
        case AccessibleRole.TAB:
            return getInterface(widget, Button)?.getLabel() ?? getInterface(widget, MenuButton)?.getLabel() ?? null;
        case AccessibleRole.TOGGLE_BUTTON:
            return getInterface(widget, ToggleButton)?.getLabel() ?? null;
        case AccessibleRole.CHECKBOX:
        case AccessibleRole.RADIO:
            return getInterface(widget, CheckButton)?.getLabel() ?? null;
        case AccessibleRole.LABEL:
            return getInterface(widget, Label)?.getLabel() ?? null;
        case AccessibleRole.TEXT_BOX:
        case AccessibleRole.SEARCH_BOX:
        case AccessibleRole.SPIN_BUTTON:
            return getInterface(widget, Editable)?.getText() ?? null;
        case AccessibleRole.GROUP:
            return getInterface(widget, Frame)?.getLabel() ?? null;
        case AccessibleRole.WINDOW:
        case AccessibleRole.DIALOG:
        case AccessibleRole.ALERT_DIALOG:
            return getInterface(widget, Window)?.getTitle() ?? null;
        case AccessibleRole.TAB_PANEL:
            return getInterface(widget, StackPage)?.getTitle() ?? null;
        case AccessibleRole.SWITCH:
            return null;
        default:
            return null;
    }
};

const getWidgetTestId = (widget: Gtk.Widget): string | null => {
    return widget.getName();
};

const getWidgetCheckedState = (widget: Gtk.Widget): boolean | undefined => {
    const accessible = getInterface(widget, Accessible);
    if (!accessible) return undefined;

    const role = accessible.getAccessibleRole();

    switch (role) {
        case AccessibleRole.CHECKBOX:
        case AccessibleRole.RADIO:
            return getInterface(widget, CheckButton)?.getActive();
        case AccessibleRole.TOGGLE_BUTTON:
            return getInterface(widget, ToggleButton)?.getActive();
        case AccessibleRole.SWITCH:
            return getInterface(widget, Switch)?.getActive();
        default:
            return undefined;
    }
};

const getWidgetExpandedState = (widget: Gtk.Widget): boolean | undefined => {
    const accessible = getInterface(widget, Accessible);
    if (!accessible) return undefined;

    const role = accessible.getAccessibleRole();

    if (role === AccessibleRole.BUTTON) {
        const parent = widget.getParent();
        if (!parent) return undefined;
        return getInterface(parent, Expander)?.getExpanded();
    }

    return undefined;
};

const matchByRoleOptions = (widget: Gtk.Widget, options?: ByRoleOptions): boolean => {
    if (!options) return true;

    if (options.name !== undefined) {
        const text = getWidgetText(widget);
        if (!matchText(text, options.name, options)) return false;
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

const formatRole = (role: AccessibleRole): string => AccessibleRole[role] ?? String(role);

const formatByRoleError = (role: AccessibleRole, options?: ByRoleOptions): string => {
    const parts = [`role "${formatRole(role)}"`];
    if (options?.name) parts.push(`name "${options.name}"`);
    if (options?.checked !== undefined) parts.push(`checked=${options.checked}`);
    if (options?.pressed !== undefined) parts.push(`pressed=${options.pressed}`);
    if (options?.selected !== undefined) parts.push(`selected=${options.selected}`);
    if (options?.expanded !== undefined) parts.push(`expanded=${options.expanded}`);
    if (options?.level !== undefined) parts.push(`level=${options.level}`);
    return parts.join(" and ");
};

const getAllByRole = (container: Container, role: AccessibleRole, options?: ByRoleOptions): Gtk.Widget[] => {
    const matches = findAll(container, (node) => {
        const accessible = getInterface(node, Accessible);
        if (!accessible || accessible.getAccessibleRole() !== role) return false;
        return matchByRoleOptions(node, options);
    });

    if (matches.length === 0) {
        throw new Error(`Unable to find any elements with ${formatByRoleError(role, options)}`);
    }
    return matches;
};

const getByRole = (container: Container, role: AccessibleRole, options?: ByRoleOptions): Gtk.Widget => {
    const matches = getAllByRole(container, role, options);

    if (matches.length > 1) {
        throw new Error(`Found ${matches.length} elements with ${formatByRoleError(role, options)}`);
    }
    const [first] = matches;
    if (!first) throw new Error(`Unable to find element with ${formatByRoleError(role, options)}`);
    return first;
};

const getAllByLabelText = (container: Container, text: string | RegExp, options?: TextMatchOptions): Gtk.Widget[] => {
    const matches = findAll(container, (node) => {
        const widgetText = getWidgetText(node);
        return matchText(widgetText, text, options);
    });

    if (matches.length === 0) {
        throw new Error(`Unable to find any elements with label text "${text}"`);
    }
    return matches;
};

const getByLabelText = (container: Container, text: string | RegExp, options?: TextMatchOptions): Gtk.Widget => {
    const matches = getAllByLabelText(container, text, options);

    if (matches.length > 1) {
        throw new Error(`Found ${matches.length} elements with label text "${text}"`);
    }
    const [first] = matches;
    if (!first) throw new Error(`Unable to find element with label text "${text}"`);
    return first;
};

const getAllByText = (container: Container, text: string | RegExp, options?: TextMatchOptions): Gtk.Widget[] => {
    const matches = findAll(container, (node) => {
        const widgetText = getWidgetText(node);
        return matchText(widgetText, text, options);
    });

    if (matches.length === 0) {
        throw new Error(`Unable to find any elements with text "${text}"`);
    }
    return matches;
};

const getByText = (container: Container, text: string | RegExp, options?: TextMatchOptions): Gtk.Widget => {
    const matches = getAllByText(container, text, options);

    if (matches.length > 1) {
        throw new Error(`Found ${matches.length} elements with text "${text}"`);
    }
    const [first] = matches;
    if (!first) throw new Error(`Unable to find element with text "${text}"`);
    return first;
};

const getAllByTestId = (container: Container, testId: string | RegExp, options?: TextMatchOptions): Gtk.Widget[] => {
    const matches = findAll(container, (node) => {
        const widgetTestId = getWidgetTestId(node);
        return matchText(widgetTestId, testId, options);
    });

    if (matches.length === 0) {
        throw new Error(`Unable to find any elements with test id "${testId}"`);
    }
    return matches;
};

const getByTestId = (container: Container, testId: string | RegExp, options?: TextMatchOptions): Gtk.Widget => {
    const matches = getAllByTestId(container, testId, options);

    if (matches.length > 1) {
        throw new Error(`Found ${matches.length} elements with test id "${testId}"`);
    }
    const [first] = matches;
    if (!first) throw new Error(`Unable to find element with test id "${testId}"`);
    return first;
};

/**
 * Waits for and finds a single widget matching the specified accessible role.
 * @param container - The container to search within
 * @param role - The accessible role to match
 * @param options - Additional filtering options (name, checked, expanded)
 * @returns Promise resolving to the matching widget
 */
export const findByRole = async (
    container: Container,
    role: AccessibleRole,
    options?: ByRoleOptions,
): Promise<Gtk.Widget> =>
    waitFor(() => getByRole(container, role, options), {
        timeout: options?.timeout,
    });

/**
 * Waits for and finds all widgets matching the specified accessible role.
 * @param container - The container to search within
 * @param role - The accessible role to match
 * @param options - Additional filtering options (name, checked, expanded)
 * @returns Promise resolving to array of matching widgets
 */
export const findAllByRole = async (
    container: Container,
    role: AccessibleRole,
    options?: ByRoleOptions,
): Promise<Gtk.Widget[]> =>
    waitFor(() => getAllByRole(container, role, options), {
        timeout: options?.timeout,
    });

/**
 * Waits for and finds a single widget matching the specified label text.
 * @param container - The container to search within
 * @param text - The text or pattern to match
 * @param options - Text matching options (exact, normalizer, timeout)
 * @returns Promise resolving to the matching widget
 */
export const findByLabelText = async (
    container: Container,
    text: string | RegExp,
    options?: TextMatchOptions,
): Promise<Gtk.Widget> =>
    waitFor(() => getByLabelText(container, text, options), {
        timeout: options?.timeout,
    });

/**
 * Waits for and finds all widgets matching the specified label text.
 * @param container - The container to search within
 * @param text - The text or pattern to match
 * @param options - Text matching options (exact, normalizer, timeout)
 * @returns Promise resolving to array of matching widgets
 */
export const findAllByLabelText = async (
    container: Container,
    text: string | RegExp,
    options?: TextMatchOptions,
): Promise<Gtk.Widget[]> =>
    waitFor(() => getAllByLabelText(container, text, options), {
        timeout: options?.timeout,
    });

/**
 * Waits for and finds a single widget matching the specified text content.
 * @param container - The container to search within
 * @param text - The text or pattern to match
 * @param options - Text matching options (exact, normalizer, timeout)
 * @returns Promise resolving to the matching widget
 */
export const findByText = async (
    container: Container,
    text: string | RegExp,
    options?: TextMatchOptions,
): Promise<Gtk.Widget> =>
    waitFor(() => getByText(container, text, options), {
        timeout: options?.timeout,
    });

/**
 * Waits for and finds all widgets matching the specified text content.
 * @param container - The container to search within
 * @param text - The text or pattern to match
 * @param options - Text matching options (exact, normalizer, timeout)
 * @returns Promise resolving to array of matching widgets
 */
export const findAllByText = async (
    container: Container,
    text: string | RegExp,
    options?: TextMatchOptions,
): Promise<Gtk.Widget[]> =>
    waitFor(() => getAllByText(container, text, options), {
        timeout: options?.timeout,
    });

/**
 * Waits for and finds a single widget matching the specified test ID.
 * @param container - The container to search within
 * @param testId - The test ID or pattern to match
 * @param options - Text matching options (exact, normalizer, timeout)
 * @returns Promise resolving to the matching widget
 */
export const findByTestId = async (
    container: Container,
    testId: string | RegExp,
    options?: TextMatchOptions,
): Promise<Gtk.Widget> =>
    waitFor(() => getByTestId(container, testId, options), {
        timeout: options?.timeout,
    });

/**
 * Waits for and finds all widgets matching the specified test ID.
 * @param container - The container to search within
 * @param testId - The test ID or pattern to match
 * @param options - Text matching options (exact, normalizer, timeout)
 * @returns Promise resolving to array of matching widgets
 */
export const findAllByTestId = async (
    container: Container,
    testId: string | RegExp,
    options?: TextMatchOptions,
): Promise<Gtk.Widget[]> =>
    waitFor(() => getAllByTestId(container, testId, options), {
        timeout: options?.timeout,
    });
