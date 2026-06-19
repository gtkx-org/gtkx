import type * as Gtk from "@gtkx/gi/gtk";
import { getConfig } from "./config.js";
import { prettyWidget } from "./pretty-widget.js";
import { formatRole, prettyRoles } from "./role-helpers.js";
import type { Container } from "./traversal.js";
import type { ByRoleOptions, ByRoleValue, Matcher } from "./types.js";

const formatTextMatcher = (text: Matcher): string => {
    if (typeof text === "function") {
        return "custom function";
    }
    if (text instanceof RegExp) {
        return text.toString();
    }
    return `'${text}'`;
};

const formatByRoleValue = (value: ByRoleValue): string => {
    const parts: string[] = [];
    if (value.now !== undefined) parts.push(`now=${value.now}`);
    if (value.min !== undefined) parts.push(`min=${value.min}`);
    if (value.max !== undefined) parts.push(`max=${value.max}`);
    if (value.text !== undefined) parts.push(`text ${formatTextMatcher(value.text)}`);
    return parts.join(", ");
};

const formatByRoleDescription = (role: Gtk.AccessibleRole, options?: ByRoleOptions): string => {
    const parts = [`role '${formatRole(role).toUpperCase()}'`];
    if (options?.name) parts.push(`name ${formatTextMatcher(options.name)}`);
    if (options?.checked !== undefined) parts.push(`checked=${options.checked}`);
    if (options?.pressed !== undefined) parts.push(`pressed=${options.pressed}`);
    if (options?.selected !== undefined) parts.push(`selected=${options.selected}`);
    if (options?.expanded !== undefined) parts.push(`expanded=${options.expanded}`);
    if (options?.level !== undefined) parts.push(`level=${options.level}`);
    if (options?.busy !== undefined) parts.push(`busy=${options.busy}`);
    if (options?.description) parts.push(`description ${formatTextMatcher(options.description)}`);
    if (options?.value) parts.push(`value ${formatByRoleValue(options.value)}`);
    if (options?.hidden !== undefined) parts.push(`hidden=${options.hidden}`);
    return parts.join(" and ");
};

/**
 * A query and the value it matched on, carried per query type so the matched
 * value is always present for its kind.
 */
export type QueryDescriptor =
    | { queryType: "role"; role: Gtk.AccessibleRole; options?: ByRoleOptions }
    | { queryType: "text"; text: Matcher }
    | { queryType: "labelText"; text: Matcher }
    | { queryType: "name"; name: Matcher }
    | { queryType: "placeholderText"; text: Matcher }
    | { queryType: "displayValue"; value: Matcher };

const formatQueryDescription = (descriptor: QueryDescriptor): string => {
    switch (descriptor.queryType) {
        case "role":
            return formatByRoleDescription(descriptor.role, descriptor.options);
        case "text":
            return `text ${formatTextMatcher(descriptor.text)}`;
        case "labelText":
            return `label text ${formatTextMatcher(descriptor.text)}`;
        case "name":
            return `name ${formatTextMatcher(descriptor.name)}`;
        case "placeholderText":
            return `placeholder text ${formatTextMatcher(descriptor.text)}`;
        case "displayValue":
            return `display value ${formatTextMatcher(descriptor.value)}`;
    }
};

/**
 * Builds an error for when no elements match a query.
 */
export const notFoundError = (container: Container, descriptor: QueryDescriptor): Error => {
    const config = getConfig();
    const description = formatQueryDescription(descriptor);
    const lines: string[] = [`Unable to find an element with ${description}`];

    if (config.showSuggestions && descriptor.queryType === "role") {
        lines.push("", "Here are the accessible roles:", "", prettyRoles(container));
    }

    lines.push("", prettyWidget(container, { highlight: false }));

    const message = lines.join("\n");
    return config.getElementError(message, container);
};

/**
 * Builds an error for when multiple elements match a query but only one was expected.
 */
export const multipleFoundError = (container: Container, descriptor: QueryDescriptor, count: number): Error => {
    const config = getConfig();
    const description = formatQueryDescription(descriptor);
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
export const timeoutError = (timeout: number, lastError: Error | null): Error => {
    const baseMessage = `Timed out after ${timeout}ms`;
    if (lastError) {
        return new Error(`${baseMessage}.\n\n${lastError.message}`);
    }
    return new Error(baseMessage);
};
