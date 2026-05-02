import type * as Gtk from "@gtkx/ffi/gtk";
import { getConfig } from "./config.js";
import { prettyWidget } from "./pretty-widget.js";
import { formatRole, prettyRoles } from "./role-helpers.js";
import type { Container } from "./traversal.js";
import type { ByRoleOptions, TextMatch } from "./types.js";

type QueryType = "role" | "text" | "labelText" | "name";

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

type QueryArgs = { role?: Gtk.AccessibleRole; text?: TextMatch; name?: TextMatch; options?: ByRoleOptions };

const formatQueryDescription = (queryType: QueryType, args: QueryArgs): string => {
    switch (queryType) {
        case "role":
            if (args.role === undefined) return "role";
            return formatByRoleDescription(args.role, args.options);
        case "text":
            if (args.text === undefined) return "text";
            return `text ${formatTextMatcher(args.text)}`;
        case "labelText":
            if (args.text === undefined) return "label text";
            return `label text ${formatTextMatcher(args.text)}`;
        case "name":
            if (args.name === undefined) return "name";
            return `name ${formatTextMatcher(args.name)}`;
    }
};

/**
 * Builds an error for when no elements match a query.
 */
export const buildNotFoundError = (container: Container, queryType: QueryType, args: QueryArgs): Error => {
    const config = getConfig();
    const description = formatQueryDescription(queryType, args);
    const lines: string[] = [`Unable to find an element with ${description}`];

    if (config.showSuggestions && queryType === "role") {
        lines.push("", "Here are the accessible roles:", "", prettyRoles(container));
    }

    lines.push("", prettyWidget(container, { highlight: false }));

    const message = lines.join("\n");
    return config.getElementError(message, container);
};

/**
 * Builds an error for when multiple elements match a query but only one was expected.
 */
export const buildMultipleFoundError = (
    container: Container,
    queryType: QueryType,
    args: QueryArgs,
    count: number,
): Error => {
    const config = getConfig();
    const description = formatQueryDescription(queryType, args);
    const lines: string[] = [
        `Found ${count} elements with ${description}, but expected only one`,
        "",
        prettyWidget(container, { highlight: false }),
    ];

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
