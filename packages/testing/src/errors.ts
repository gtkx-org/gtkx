import type * as Gtk from "@gtkx/gi/gtk";
import type { Container } from "./traversal.js";
import type { ByRoleOptions, ByRoleValue, Matcher } from "./types.js";
import { getConfig } from "./config.js";
import { prettyWidget } from "./pretty-widget.js";
import { formatRole, prettyRoles } from "./role-helpers.js";

type QueryDescriptor =
    | { queryType: "role"; role: Gtk.AccessibleRole; options?: ByRoleOptions | undefined } |
    { queryType: "text"; text: Matcher } |
    { queryType: "labelText"; text: Matcher } |
    { queryType: "name"; name: Matcher } |
    { queryType: "placeholderText"; text: Matcher } |
    { queryType: "displayValue"; value: Matcher };

const roleOptionFormatters: ((options: ByRoleOptions) => string | null)[] = [
    (o) => (o.name ? `name ${formatTextMatcher(o.name)}` : null),
    (o) => (o.checked === undefined ? null : `checked=${o.checked}`),
    (o) => (o.pressed === undefined ? null : `pressed=${o.pressed}`),
    (o) => (o.selected === undefined ? null : `selected=${o.selected}`),
    (o) => (o.expanded === undefined ? null : `expanded=${o.expanded}`),
    (o) => (o.level === undefined ? null : `level=${o.level}`),
    (o) => (o.busy === undefined ? null : `busy=${o.busy}`),
    (o) => (o.description ? `description ${formatTextMatcher(o.description)}` : null),
    (o) => (o.value ? `value ${formatByRoleValue(o.value)}` : null),
    (o) => (o.hidden === undefined ? null : `hidden=${o.hidden}`),
];

let expensiveErrorDiagnosticsDisabled = false;

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

const roleOptionParts = (options: ByRoleOptions): string[] => {
    const parts: string[] = [];

    for (const formatter of roleOptionFormatters) {
        const part = formatter(options);
        if (part !== null) parts.push(part);
    }

    return parts;
};

const formatByRoleDescription = (role: Gtk.AccessibleRole, options?: ByRoleOptions): string => {
    const parts = [`role '${formatRole(role).toUpperCase()}'`];
    if (options) parts.push(...roleOptionParts(options));
    return parts.join(" and ");
};

const formatQueryDescription = (descriptor: QueryDescriptor): string => {
    switch (descriptor.queryType) {
        case "role": {
            return formatByRoleDescription(descriptor.role, descriptor.options);
        }
        case "text": {
            return `text ${formatTextMatcher(descriptor.text)}`;
        }
        case "labelText": {
            return `label text ${formatTextMatcher(descriptor.text)}`;
        }
        case "name": {
            return `name ${formatTextMatcher(descriptor.name)}`;
        }
        case "placeholderText": {
            return `placeholder text ${formatTextMatcher(descriptor.text)}`;
        }
        case "displayValue": {
            return `display value ${formatTextMatcher(descriptor.value)}`;
        }
    }
};

const runWithExpensiveErrorDiagnosticsDisabled = <T>(callback: () => T): T => {
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

const notFoundError = (container: Container, descriptor: QueryDescriptor): Error => {
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

const multipleFoundError = (container: Container, descriptor: QueryDescriptor, matches: Gtk.Widget[]): Error => {
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

const suggestionError = (suggestion: string, container: Container): Error => {
    const config = getConfig();
    const message = `A better query is available, try this:\n${suggestion}\n`;
    return config.getElementError(message, container);
};

const timeoutError = (timeout: number, lastError: Error | null): Error => {
    const baseMessage = `Timed out after ${timeout}ms`;
    const message = lastError ? `${baseMessage}.\n\n${lastError.message}` : baseMessage;
    return getConfig().getElementError(message);
};

export {
    runWithExpensiveErrorDiagnosticsDisabled,
    notFoundError,
    multipleFoundError,
    suggestionError,
    timeoutError,
    type QueryDescriptor,
};
