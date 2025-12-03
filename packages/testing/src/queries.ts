import type * as Gtk from "@gtkx/ffi/gtk";
import { type Accessible, AccessibleRole } from "@gtkx/ffi/gtk";
import { call } from "@gtkx/native";
import { findAll } from "./traversal.js";
import type { ByRoleOptions, TextMatchOptions } from "./types.js";
import { waitFor } from "./wait-for.js";
import { getWidgetPtr } from "./widget.js";

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

const callGetter = (ptr: unknown, funcName: string): string | null => {
    const result = call("libgtk-4.so.1", funcName, [{ type: { type: "gobject" }, value: ptr }], {
        type: "string",
        borrowed: true,
    });
    return result as string | null;
};

const isInternalLabel = (widget: Gtk.Widget): boolean => {
    const accessible = widget as unknown as Accessible;
    if (accessible.getAccessibleRole() !== AccessibleRole.LABEL) return false;

    const parent = widget.getParent();
    if (!parent) return false;

    const parentAccessible = parent as unknown as Accessible;
    const parentRole = parentAccessible.getAccessibleRole();

    return (
        parentRole === AccessibleRole.BUTTON ||
        parentRole === AccessibleRole.TOGGLE_BUTTON ||
        parentRole === AccessibleRole.CHECKBOX ||
        parentRole === AccessibleRole.RADIO ||
        parentRole === AccessibleRole.MENU_ITEM ||
        parentRole === AccessibleRole.MENU_ITEM_CHECKBOX ||
        parentRole === AccessibleRole.MENU_ITEM_RADIO
    );
};

const getWidgetText = (widget: Gtk.Widget): string | null => {
    const ptr = getWidgetPtr(widget);
    if (!ptr) return null;

    if (isInternalLabel(widget)) return null;

    const accessible = widget as unknown as Accessible;
    const role = accessible.getAccessibleRole();

    switch (role) {
        case AccessibleRole.BUTTON:
        case AccessibleRole.TOGGLE_BUTTON:
        case AccessibleRole.CHECKBOX:
        case AccessibleRole.RADIO:
        case AccessibleRole.MENU_ITEM:
        case AccessibleRole.MENU_ITEM_CHECKBOX:
        case AccessibleRole.MENU_ITEM_RADIO:
            return callGetter(ptr, "gtk_button_get_label");
        case AccessibleRole.LABEL:
            return callGetter(ptr, "gtk_label_get_label");
        case AccessibleRole.TEXT_BOX:
        case AccessibleRole.SEARCH_BOX:
        case AccessibleRole.SPIN_BUTTON:
            return callGetter(ptr, "gtk_editable_get_text");
        default:
            return null;
    }
};

const getWidgetTestId = (widget: Gtk.Widget): string | null => {
    const ptr = getWidgetPtr(widget);
    if (!ptr) return null;

    const result = call("libgtk-4.so.1", "gtk_widget_get_name", [{ type: { type: "gobject" }, value: ptr }], {
        type: "string",
        borrowed: true,
    });
    return result as string | null;
};

const getWidgetCheckedState = (widget: Gtk.Widget): boolean | undefined => {
    const ptr = getWidgetPtr(widget);
    if (!ptr) return undefined;

    const accessible = widget as unknown as Accessible;
    const role = accessible.getAccessibleRole();

    if (role === AccessibleRole.CHECKBOX || role === AccessibleRole.RADIO) {
        const result = call(
            "libgtk-4.so.1",
            "gtk_check_button_get_active",
            [{ type: { type: "gobject" }, value: ptr }],
            {
                type: "boolean",
            },
        );
        return result === true;
    }

    if (role === AccessibleRole.TOGGLE_BUTTON) {
        const result = call(
            "libgtk-4.so.1",
            "gtk_toggle_button_get_active",
            [{ type: { type: "gobject" }, value: ptr }],
            { type: "boolean" },
        );
        return result === true;
    }

    return undefined;
};

const getWidgetExpandedState = (widget: Gtk.Widget): boolean | undefined => {
    const ptr = getWidgetPtr(widget);
    if (!ptr) return undefined;

    const accessible = widget as unknown as Accessible;
    const role = accessible.getAccessibleRole();

    if (role === AccessibleRole.BUTTON) {
        const expanderPtr = call(
            "libgtk-4.so.1",
            "gtk_widget_get_parent",
            [{ type: { type: "gobject" }, value: ptr }],
            { type: "gobject" },
        );
        if (!expanderPtr) return undefined;

        const result = call(
            "libgtk-4.so.1",
            "gtk_expander_get_expanded",
            [{ type: { type: "gobject" }, value: expanderPtr }],
            { type: "boolean" },
        );
        return result === true;
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

/**
 * Finds all widgets matching the specified accessible role.
 * @param container - The container to search within
 * @param role - The accessible role to match
 * @param options - Additional filtering options (name, checked, expanded)
 * @returns Array of matching widgets
 * @throws If no elements are found
 */
export const getAllByRole = (container: Container, role: AccessibleRole, options?: ByRoleOptions): Gtk.Widget[] => {
    const matches = findAll(container, (node) => {
        const accessible = node as unknown as Accessible;
        if (accessible.getAccessibleRole() !== role) return false;
        return matchByRoleOptions(node, options);
    });

    if (matches.length === 0) {
        throw new Error(`Unable to find any elements with ${formatByRoleError(role, options)}`);
    }
    return matches;
};

/**
 * Finds a single widget matching the specified accessible role.
 * @param container - The container to search within
 * @param role - The accessible role to match
 * @param options - Additional filtering options (name, checked, expanded)
 * @returns The matching widget
 * @throws If no elements or multiple elements are found
 */
export const getByRole = (container: Container, role: AccessibleRole, options?: ByRoleOptions): Gtk.Widget => {
    const matches = getAllByRole(container, role, options);

    if (matches.length > 1) {
        throw new Error(`Found ${matches.length} elements with ${formatByRoleError(role, options)}`);
    }
    return matches[0] as Gtk.Widget;
};

/**
 * Queries all widgets matching the specified accessible role without throwing.
 * @param container - The container to search within
 * @param role - The accessible role to match
 * @param options - Additional filtering options (name, checked, expanded)
 * @returns Array of matching widgets (empty if none found)
 */
export const queryAllByRole = (container: Container, role: AccessibleRole, options?: ByRoleOptions): Gtk.Widget[] => {
    return findAll(container, (node) => {
        const accessible = node as unknown as Accessible;
        if (accessible.getAccessibleRole() !== role) return false;
        return matchByRoleOptions(node, options);
    });
};

/**
 * Queries a single widget matching the specified accessible role without throwing.
 * @param container - The container to search within
 * @param role - The accessible role to match
 * @param options - Additional filtering options (name, checked, expanded)
 * @returns The matching widget or null if not found
 * @throws If multiple elements are found
 */
export const queryByRole = (container: Container, role: AccessibleRole, options?: ByRoleOptions): Gtk.Widget | null => {
    const matches = queryAllByRole(container, role, options);

    if (matches.length > 1) {
        throw new Error(`Found ${matches.length} elements with ${formatByRoleError(role, options)}`);
    }
    return matches[0] ?? null;
};

/**
 * Finds all widgets matching the specified label text.
 * @param container - The container to search within
 * @param text - The text or pattern to match
 * @param options - Text matching options (exact, normalizer)
 * @returns Array of matching widgets
 * @throws If no elements are found
 */
export const getAllByLabelText = (
    container: Container,
    text: string | RegExp,
    options?: TextMatchOptions,
): Gtk.Widget[] => {
    const matches = findAll(container, (node) => {
        const widgetText = getWidgetText(node);
        return matchText(widgetText, text, options);
    });

    if (matches.length === 0) {
        throw new Error(`Unable to find any elements with label text "${text}"`);
    }
    return matches;
};

/**
 * Finds a single widget matching the specified label text.
 * @param container - The container to search within
 * @param text - The text or pattern to match
 * @param options - Text matching options (exact, normalizer)
 * @returns The matching widget
 * @throws If no elements or multiple elements are found
 */
export const getByLabelText = (container: Container, text: string | RegExp, options?: TextMatchOptions): Gtk.Widget => {
    const matches = getAllByLabelText(container, text, options);

    if (matches.length > 1) {
        throw new Error(`Found ${matches.length} elements with label text "${text}"`);
    }
    return matches[0] as Gtk.Widget;
};

/**
 * Queries all widgets matching the specified label text without throwing.
 * @param container - The container to search within
 * @param text - The text or pattern to match
 * @param options - Text matching options (exact, normalizer)
 * @returns Array of matching widgets (empty if none found)
 */
export const queryAllByLabelText = (
    container: Container,
    text: string | RegExp,
    options?: TextMatchOptions,
): Gtk.Widget[] => {
    return findAll(container, (node) => {
        const widgetText = getWidgetText(node);
        return matchText(widgetText, text, options);
    });
};

/**
 * Queries a single widget matching the specified label text without throwing.
 * @param container - The container to search within
 * @param text - The text or pattern to match
 * @param options - Text matching options (exact, normalizer)
 * @returns The matching widget or null if not found
 * @throws If multiple elements are found
 */
export const queryByLabelText = (
    container: Container,
    text: string | RegExp,
    options?: TextMatchOptions,
): Gtk.Widget | null => {
    const matches = queryAllByLabelText(container, text, options);

    if (matches.length > 1) {
        throw new Error(`Found ${matches.length} elements with label text "${text}"`);
    }
    return matches[0] ?? null;
};

/**
 * Finds all widgets matching the specified text content.
 * @param container - The container to search within
 * @param text - The text or pattern to match
 * @param options - Text matching options (exact, normalizer)
 * @returns Array of matching widgets
 * @throws If no elements are found
 */
export const getAllByText = (container: Container, text: string | RegExp, options?: TextMatchOptions): Gtk.Widget[] => {
    const matches = findAll(container, (node) => {
        const widgetText = getWidgetText(node);
        return matchText(widgetText, text, options);
    });

    if (matches.length === 0) {
        throw new Error(`Unable to find any elements with text "${text}"`);
    }
    return matches;
};

/**
 * Finds a single widget matching the specified text content.
 * @param container - The container to search within
 * @param text - The text or pattern to match
 * @param options - Text matching options (exact, normalizer)
 * @returns The matching widget
 * @throws If no elements or multiple elements are found
 */
export const getByText = (container: Container, text: string | RegExp, options?: TextMatchOptions): Gtk.Widget => {
    const matches = getAllByText(container, text, options);

    if (matches.length > 1) {
        throw new Error(`Found ${matches.length} elements with text "${text}"`);
    }
    return matches[0] as Gtk.Widget;
};

/**
 * Queries all widgets matching the specified text content without throwing.
 * @param container - The container to search within
 * @param text - The text or pattern to match
 * @param options - Text matching options (exact, normalizer)
 * @returns Array of matching widgets (empty if none found)
 */
export const queryAllByText = (
    container: Container,
    text: string | RegExp,
    options?: TextMatchOptions,
): Gtk.Widget[] => {
    return findAll(container, (node) => {
        const widgetText = getWidgetText(node);
        return matchText(widgetText, text, options);
    });
};

/**
 * Queries a single widget matching the specified text content without throwing.
 * @param container - The container to search within
 * @param text - The text or pattern to match
 * @param options - Text matching options (exact, normalizer)
 * @returns The matching widget or null if not found
 * @throws If multiple elements are found
 */
export const queryByText = (
    container: Container,
    text: string | RegExp,
    options?: TextMatchOptions,
): Gtk.Widget | null => {
    const matches = queryAllByText(container, text, options);

    if (matches.length > 1) {
        throw new Error(`Found ${matches.length} elements with text "${text}"`);
    }
    return matches[0] ?? null;
};

/**
 * Finds all widgets matching the specified test ID.
 * @param container - The container to search within
 * @param testId - The test ID or pattern to match
 * @param options - Text matching options (exact, normalizer)
 * @returns Array of matching widgets
 * @throws If no elements are found
 */
export const getAllByTestId = (
    container: Container,
    testId: string | RegExp,
    options?: TextMatchOptions,
): Gtk.Widget[] => {
    const matches = findAll(container, (node) => {
        const widgetTestId = getWidgetTestId(node);
        return matchText(widgetTestId, testId, options);
    });

    if (matches.length === 0) {
        throw new Error(`Unable to find any elements with test id "${testId}"`);
    }
    return matches;
};

/**
 * Finds a single widget matching the specified test ID.
 * @param container - The container to search within
 * @param testId - The test ID or pattern to match
 * @param options - Text matching options (exact, normalizer)
 * @returns The matching widget
 * @throws If no elements or multiple elements are found
 */
export const getByTestId = (container: Container, testId: string | RegExp, options?: TextMatchOptions): Gtk.Widget => {
    const matches = getAllByTestId(container, testId, options);

    if (matches.length > 1) {
        throw new Error(`Found ${matches.length} elements with test id "${testId}"`);
    }
    return matches[0] as Gtk.Widget;
};

/**
 * Queries all widgets matching the specified test ID without throwing.
 * @param container - The container to search within
 * @param testId - The test ID or pattern to match
 * @param options - Text matching options (exact, normalizer)
 * @returns Array of matching widgets (empty if none found)
 */
export const queryAllByTestId = (
    container: Container,
    testId: string | RegExp,
    options?: TextMatchOptions,
): Gtk.Widget[] => {
    return findAll(container, (node) => {
        const widgetTestId = getWidgetTestId(node);
        return matchText(widgetTestId, testId, options);
    });
};

/**
 * Queries a single widget matching the specified test ID without throwing.
 * @param container - The container to search within
 * @param testId - The test ID or pattern to match
 * @param options - Text matching options (exact, normalizer)
 * @returns The matching widget or null if not found
 * @throws If multiple elements are found
 */
export const queryByTestId = (
    container: Container,
    testId: string | RegExp,
    options?: TextMatchOptions,
): Gtk.Widget | null => {
    const matches = queryAllByTestId(container, testId, options);

    if (matches.length > 1) {
        throw new Error(`Found ${matches.length} elements with test id "${testId}"`);
    }
    return matches[0] ?? null;
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
): Promise<Gtk.Widget> => waitFor(() => getByRole(container, role, options));

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
): Promise<Gtk.Widget[]> => waitFor(() => getAllByRole(container, role, options));

/**
 * Waits for and finds a single widget matching the specified label text.
 * @param container - The container to search within
 * @param text - The text or pattern to match
 * @param options - Text matching options (exact, normalizer)
 * @returns Promise resolving to the matching widget
 */
export const findByLabelText = async (
    container: Container,
    text: string | RegExp,
    options?: TextMatchOptions,
): Promise<Gtk.Widget> => waitFor(() => getByLabelText(container, text, options));

/**
 * Waits for and finds all widgets matching the specified label text.
 * @param container - The container to search within
 * @param text - The text or pattern to match
 * @param options - Text matching options (exact, normalizer)
 * @returns Promise resolving to array of matching widgets
 */
export const findAllByLabelText = async (
    container: Container,
    text: string | RegExp,
    options?: TextMatchOptions,
): Promise<Gtk.Widget[]> => waitFor(() => getAllByLabelText(container, text, options));

/**
 * Waits for and finds a single widget matching the specified text content.
 * @param container - The container to search within
 * @param text - The text or pattern to match
 * @param options - Text matching options (exact, normalizer)
 * @returns Promise resolving to the matching widget
 */
export const findByText = async (
    container: Container,
    text: string | RegExp,
    options?: TextMatchOptions,
): Promise<Gtk.Widget> => waitFor(() => getByText(container, text, options));

/**
 * Waits for and finds all widgets matching the specified text content.
 * @param container - The container to search within
 * @param text - The text or pattern to match
 * @param options - Text matching options (exact, normalizer)
 * @returns Promise resolving to array of matching widgets
 */
export const findAllByText = async (
    container: Container,
    text: string | RegExp,
    options?: TextMatchOptions,
): Promise<Gtk.Widget[]> => waitFor(() => getAllByText(container, text, options));

/**
 * Waits for and finds a single widget matching the specified test ID.
 * @param container - The container to search within
 * @param testId - The test ID or pattern to match
 * @param options - Text matching options (exact, normalizer)
 * @returns Promise resolving to the matching widget
 */
export const findByTestId = async (
    container: Container,
    testId: string | RegExp,
    options?: TextMatchOptions,
): Promise<Gtk.Widget> => waitFor(() => getByTestId(container, testId, options));

/**
 * Waits for and finds all widgets matching the specified test ID.
 * @param container - The container to search within
 * @param testId - The test ID or pattern to match
 * @param options - Text matching options (exact, normalizer)
 * @returns Promise resolving to array of matching widgets
 */
export const findAllByTestId = async (
    container: Container,
    testId: string | RegExp,
    options?: TextMatchOptions,
): Promise<Gtk.Widget[]> => waitFor(() => getAllByTestId(container, testId, options));
