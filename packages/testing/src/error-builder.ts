import type * as Gtk from "@gtkx/ffi/gtk";
import { getConfig } from "./config.js";
import { prettyWidget } from "./pretty-widget.js";
import { formatRole, prettyRoles } from "./role-helpers.js";
import type { Container } from "./traversal.js";
import type { ByRoleOptions, TextMatch } from "./types.js";

type QueryType = "role" | "text" | "labelText" | "testId";

const formatTextMatcher = (text: TextMatch): string => {
    if (typeof text === "function") {
        return "custom function";
    }
    if (text instanceof RegExp) {
        return text.toString();
    }
    return `'${text}'`;
};

const formatByRoleDescription = (role: Gtk.AccessibleRole, options?: ByRoleOptions): string => {
    const parts = [`role '${formatRole(role).toUpperCase()}'`];
    if (options?.name) parts.push(`name ${formatTextMatcher(options.name)}`);
    if (options?.checked !== undefined) parts.push(`checked=${options.checked}`);
    if (options?.pressed !== undefined) parts.push(`pressed=${options.pressed}`);
    if (options?.selected !== undefined) parts.push(`selected=${options.selected}`);
    if (options?.expanded !== undefined) parts.push(`expanded=${options.expanded}`);
    if (options?.level !== undefined) parts.push(`level=${options.level}`);
    return parts.join(" and ");
};

const formatQueryDescription = (
    queryType: QueryType,
    args: { role?: Gtk.AccessibleRole; text?: TextMatch; testId?: TextMatch; options?: ByRoleOptions },
): string => {
    switch (queryType) {
        case "role":
            return formatByRoleDescription(args.role as Gtk.AccessibleRole, args.options);
        case "text":
            return `text ${formatTextMatcher(args.text as TextMatch)}`;
        case "labelText":
            return `label text ${formatTextMatcher(args.text as TextMatch)}`;
        case "testId":
            return `test id ${formatTextMatcher(args.testId as TextMatch)}`;
    }
};

/**
 * Builds an error for when no elements match a query.
 */
export const buildNotFoundError = (
    container: Container,
    queryType: QueryType,
    args: { role?: Gtk.AccessibleRole; text?: TextMatch; testId?: TextMatch; options?: ByRoleOptions },
): Error => {
    const config = getConfig();
    const description = formatQueryDescription(queryType, args);
    const lines: string[] = [`Unable to find an element with ${description}`];

    if (config.showSuggestions && queryType === "role") {
        lines.push("");
        lines.push("Here are the accessible roles:");
        lines.push("");
        lines.push(prettyRoles(container));
    }

    lines.push("");
    lines.push(prettyWidget(container, { highlight: false }));

    const message = lines.join("\n");
    return config.getElementError(message, container);
};

/**
 * Builds an error for when multiple elements match a query but only one was expected.
 */
export const buildMultipleFoundError = (
    container: Container,
    queryType: QueryType,
    args: { role?: Gtk.AccessibleRole; text?: TextMatch; testId?: TextMatch; options?: ByRoleOptions },
    count: number,
): Error => {
    const config = getConfig();
    const description = formatQueryDescription(queryType, args);
    const lines: string[] = [`Found ${count} elements with ${description}, but expected only one`];

    lines.push("");
    lines.push(prettyWidget(container, { highlight: false }));

    const message = lines.join("\n");
    return config.getElementError(message, container);
};

/**
 * Builds a timeout error with the last query error message.
 */
export const buildTimeoutError = (timeout: number, lastError: Error | null): Error => {
    const baseMessage = `Timed out after ${timeout}ms`;
    if (lastError) {
        return new Error(`${baseMessage}.\n\n${lastError.message}`);
    }
    return new Error(baseMessage);
};
