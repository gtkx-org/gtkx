import * as Gtk from "@gtkx/gi/gtk";
import { reverseNumericEnum, sortedAlphaBy } from "@gtkx/utils";
import { type Container, traverse } from "./traversal.js";
import { getWidgetAccessibleName } from "./widget-text.js";

export type RoleInfo = {
    widget: Gtk.Widget;
    name: string | null;
};

const ROLE_NAMES_BY_VALUE = reverseNumericEnum(Gtk.AccessibleRole);

export const formatRole = (role: Gtk.AccessibleRole): string => {
    const name = ROLE_NAMES_BY_VALUE.get(role);
    if (!name) return String(role);
    return name.toLowerCase();
};

export const formatRoleList = (roles: Iterable<Gtk.AccessibleRole>): string => {
    const names = [...roles].map((role) => formatRole(role).toUpperCase());
    if (names.length <= 1) {
        return names.join("");
    }
    if (names.length === 2) {
        return `${names[0]} or ${names[1]}`;
    }
    const head = names.slice(0, -1);
    const last = names[names.length - 1];
    return `${head.join(", ")}, or ${last}`;
};

export const getRoles = (container: Container): Map<string, RoleInfo[]> => {
    const roles = new Map<string, RoleInfo[]>();

    for (const widget of traverse(container)) {
        const role = widget.getAccessibleRole();

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
    const roleAttr = formatRole(widget.getAccessibleRole());
    const nameDisplay = name ? `Name "${name}"` : 'Name ""';
    return `${nameDisplay}: <${tagName} role="${roleAttr}">${name ?? ""}</${tagName}>`;
};

export const prettyRoles = (container: Container): string => {
    const roles = getRoles(container);

    if (roles.size === 0) {
        return "No accessible roles found in the widget tree.";
    }

    const lines: string[] = [];

    const sortedRoles = sortedAlphaBy([...roles.entries()], ([roleName]) => roleName);

    for (const [roleName, widgets] of sortedRoles) {
        lines.push(`${roleName}:`);
        for (const { widget, name } of widgets) {
            lines.push(`  ${formatWidgetPreview(widget, name)}`);
        }
        lines.push("");
    }

    return lines.join("\n").trimEnd();
};

export const logRoles = (container: Container): void => {
    console.log(prettyRoles(container));
};
