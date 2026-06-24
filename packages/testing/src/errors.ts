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

export type QueryDescriptor =
    | { queryType: "role"; role: Gtk.AccessibleRole; options?: ByRoleOptions | undefined }
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

let expensiveErrorDiagnosticsDisabled = false;

export const runWithExpensiveErrorDiagnosticsDisabled = <T>(callback: () => T): T => {
    const previous = expensiveErrorDiagnosticsDisabled;
    expensiveErrorDiagnosticsDisabled = true;
    try {
        return callback();
    } finally {
        expensiveErrorDiagnosticsDisabled = previous;
    }
};

const buildElementError = (container: Container, headLines: string[]): Error => {
    const config = getConfig();
    const lines = expensiveErrorDiagnosticsDisabled
        ? headLines
        : [...headLines, "", prettyWidget(container, { highlight: false })];
    return config.getElementError(lines.join("\n"), container);
};

export const notFoundError = (container: Container, descriptor: QueryDescriptor): Error => {
    const description = formatQueryDescription(descriptor);
    const headLines = [`Unable to find an element with ${description}`];

    if (!expensiveErrorDiagnosticsDisabled && descriptor.queryType === "role") {
        headLines.push("", "Here are the accessible roles:", "", prettyRoles(container));
    }

    return buildElementError(container, headLines);
};

const allByVariantHint = (descriptor: QueryDescriptor): string => {
    const variant = descriptor.queryType === "role" ? "getAllByRole" : "getAllBy*";
    return (
        "(If this is intentional, use the *AllBy* variant of the query, " +
        `e.g. queryAllBy*/getAllBy*/findAllBy*, such as ${variant}.)`
    );
};

export const multipleFoundError = (container: Container, descriptor: QueryDescriptor, matches: Gtk.Widget[]): Error => {
    const description = formatQueryDescription(descriptor);
    const headLines = [
        `Found ${matches.length} elements with ${description}, but expected only one`,
        "",
        allByVariantHint(descriptor),
    ];
    if (!expensiveErrorDiagnosticsDisabled) {
        const renderedMatches = matches.map((widget) => prettyWidget(widget, { highlight: false }));
        headLines.push("", "Here are the matching elements:", "", ...renderedMatches);
    }
    return buildElementError(container, headLines);
};

export const suggestionError = (suggestion: string, container: Container): Error => {
    const config = getConfig();
    const message = `A better query is available, try this:\n${suggestion}\n`;
    return config.getElementError(message, container);
};

export const timeoutError = (timeout: number, lastError: Error | null): Error => {
    const baseMessage = `Timed out after ${timeout}ms`;
    const message = lastError ? `${baseMessage}.\n\n${lastError.message}` : baseMessage;
    return getConfig().getElementError(message);
};
