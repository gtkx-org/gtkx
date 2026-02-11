import * as Gtk from "@gtkx/ffi/gtk";
import { type Container, traverse } from "./traversal.js";
import { getWidgetAccessibleName } from "./widget-text.js";

/**
 * Information about a widget and its accessible name.
 */
export type RoleInfo = {
    widget: Gtk.Widget;
    name: string | null;
};

/**
 * Formats a GTK accessible role to a lowercase string.
 *
 * @param role - The GTK accessible role
 * @returns Lowercase role name (e.g., "button", "checkbox")
 */
export const formatRole = (role: Gtk.AccessibleRole | undefined): string => {
    if (role === undefined) return "unknown";
    const name = Gtk.AccessibleRole[role];
    if (!name) return String(role);
    return name.toLowerCase();
};

/**
 * Collects all accessible roles and their widgets from a container.
 *
 * Returns a Map where keys are role names (lowercase) and values are
 * arrays of widgets with that role, including their accessible names.
 *
 * @param container - The container to scan for roles
 * @returns Map of role names to arrays of RoleInfo
 *
 * @example
 * ```tsx
 * import { getRoles } from "@gtkx/testing";
 *
 * const roles = getRoles(container);
 * // Map {
 * //   "button" => [{ widget: ..., name: "Submit" }, { widget: ..., name: "Cancel" }],
 * //   "checkbox" => [{ widget: ..., name: "Remember me" }]
 * // }
 * ```
 */
export const getRoles = (container: Container): Map<string, RoleInfo[]> => {
    const roles = new Map<string, RoleInfo[]>();

    for (const widget of traverse(container)) {
        const role = widget.getAccessibleRole?.();
        if (role === undefined) continue;

        const roleName = formatRole(role);
        const name = getWidgetAccessibleName(widget);
        const info: RoleInfo = { widget, name };

        const existing = roles.get(roleName);
        if (existing) {
            existing.push(info);
        } else {
            roles.set(roleName, [info]);
        }
    }

    return roles;
};

const formatWidgetPreview = (widget: Gtk.Widget, name: string | null): string => {
    const tagName = widget.constructor.name;
    const roleAttr = formatRole(widget.getAccessibleRole?.());
    const nameDisplay = name ? `Name "${name}"` : 'Name ""';
    return `${nameDisplay}: <${tagName} role="${roleAttr}">${name ?? ""}</${tagName}>`;
};

/**
 * Formats roles into a readable string for error messages.
 *
 * @param container - The container to format roles for
 * @returns Formatted string showing all roles and their accessible names
 */
export const prettyRoles = (container: Container): string => {
    const roles = getRoles(container);

    if (roles.size === 0) {
        return "No accessible roles found in the widget tree.";
    }

    const lines: string[] = [];

    const sortedRoles = [...roles.entries()].sort(([a], [b]) => a.localeCompare(b));

    for (const [roleName, widgets] of sortedRoles) {
        lines.push(`${roleName}:`);
        for (const { widget, name } of widgets) {
            lines.push(`  ${formatWidgetPreview(widget, name)}`);
        }
        lines.push("");
    }

    return lines.join("\n").trimEnd();
};

/**
 * Logs all accessible roles in a container to the console.
 *
 * Useful for debugging test failures and discovering available roles.
 *
 * @param container - The container to log roles for
 *
 * @example
 * ```tsx
 * import { render, logRoles } from "@gtkx/testing";
 *
 * const { container } = await render(<MyComponent />);
 * logRoles(container);
 * // Console output:
 * // button:
 * //   Name "Submit": <GtkButton role="button">Submit</GtkButton>
 * //   Name "Cancel": <GtkButton role="button">Cancel</GtkButton>
 * // checkbox:
 * //   Name "Remember me": <GtkCheckButton role="checkbox">Remember me</GtkCheckButton>
 * ```
 */
export const logRoles = (container: Container): void => {
    console.log(prettyRoles(container));
};
