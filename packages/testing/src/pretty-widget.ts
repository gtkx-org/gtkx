import type * as Gtk from "@gtkx/gi/gtk";
import { formatRole } from "./role-helpers.js";
import { type Container, roots } from "./traversal.js";
import { getWidgetPropertyText } from "./widget-text.js";

const DEFAULT_MAX_LENGTH = 7000;
const INDENT = "  ";

/**
 * Resolves a stable id for a widget, for the optional `id` attribute the printer
 * renders.
 *
 * @param widget - The widget to identify.
 * @returns The id string.
 */
export type WidgetIdResolver = (widget: Gtk.Widget) => string;

/**
 * Options for {@link prettyWidget}.
 */
export type PrettyWidgetOptions = {
    /** Maximum output length before truncation (default: 7000) */
    maxLength?: number;
    /** Enable ANSI color highlighting (default: auto-detect) */
    highlight?: boolean;
    /** Resolve a stable widget id for the `id` attribute, for MCP/agentic interactions */
    getId?: WidgetIdResolver;
};

const buildAttrs = (
    widget: Gtk.Widget,
    getId: WidgetIdResolver | undefined,
): ReadonlyArray<readonly [string, string]> => {
    const attrs: [string, string][] = [];

    if (getId) {
        attrs.push(["id", getId(widget)]);
    }

    const name = widget.getName();
    if (name) {
        attrs.push(["name", name]);
    }

    attrs.push(["role", formatRole(widget.getAccessibleRole())]);

    if (!widget.getSensitive()) {
        attrs.push(["accessible-disabled", "true"]);
    }

    if (!widget.getVisible()) {
        attrs.push(["accessible-hidden", "true"]);
    }

    return attrs.toSorted(([a], [b]) => {
        if (a === "id") return -1;
        if (b === "id") return 1;
        return a.localeCompare(b);
    });
};

type Colors = {
    tag: (s: string) => string;
    attr: (s: string) => string;
    value: (s: string) => string;
};

const ansi = {
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    green: "\x1b[32m",
    reset: "\x1b[0m",
};

const shouldHighlight = (): boolean => {
    if (typeof process === "undefined") return false;
    if (process.env.COLORS === "false" || process.env.NO_COLOR) return false;
    if (process.env.COLORS === "true" || process.env.FORCE_COLOR) return true;
    return process.stdout?.isTTY ?? false;
};

const createColors = (enabled: boolean): Colors => {
    if (!enabled) {
        const identity = (s: string): string => s;
        return { tag: identity, attr: identity, value: identity };
    }
    return {
        tag: (s) => `${ansi.cyan}${s}${ansi.reset}`,
        attr: (s) => `${ansi.yellow}${s}${ansi.reset}`,
        value: (s) => `${ansi.green}${s}${ansi.reset}`,
    };
};

const escapeAttrValue = (value: string): string => value.replaceAll('"', "&quot;");

const formatAttrs = (attrs: ReadonlyArray<readonly [string, string]>, colors: Colors): string =>
    attrs.map(([key, value]) => ` ${colors.attr(key)}=${colors.value(`"${escapeAttrValue(value)}"`)}`).join("");

const formatWidget = (
    widget: Gtk.Widget,
    depth: number,
    getId: WidgetIdResolver | undefined,
    colors: Colors,
): string => {
    const indent = INDENT.repeat(depth);
    const tag = widget.constructor.name;
    const attrs = formatAttrs(buildAttrs(widget, getId), colors);
    const openTag = `${colors.tag("<")}${colors.tag(tag)}${attrs}${colors.tag(">")}`;
    const closeTag = `${colors.tag("</")}${colors.tag(tag)}${colors.tag(">")}`;

    const text = getWidgetPropertyText(widget);
    const firstChild = widget.getFirstChild();

    if (!text && !firstChild) {
        return `${indent}${openTag}\n`;
    }

    let output = `${indent}${openTag}\n`;
    if (text) {
        output += `${indent}${INDENT}${text}\n`;
    }
    let child = firstChild;
    while (child) {
        output += formatWidget(child, depth + 1, getId, colors);
        child = child.getNextSibling();
    }
    output += `${indent}${closeTag}\n`;
    return output;
};

/**
 * Formats a widget tree as a readable string for debugging.
 *
 * Renders the widget hierarchy in an HTML-like format with accessibility
 * attributes like role, name, and text content.
 *
 * @param container - The container widget or application to format
 * @param options - Formatting options for length and highlighting
 * @returns Formatted string representation of the widget tree
 *
 * @example
 * ```tsx
 * import { prettyWidget } from "@gtkx/testing";
 *
 * console.log(prettyWidget(application));
 * // Output:
 * // <GtkApplicationWindow role="window">
 * //   <GtkButton role="button">
 * //     Click me
 * //   </GtkButton>
 * // </GtkApplicationWindow>
 * ```
 */
export const prettyWidget = (container: Container, options: PrettyWidgetOptions = {}): string => {
    const envLimit = process.env.DEBUG_PRINT_LIMIT ? Number(process.env.DEBUG_PRINT_LIMIT) : DEFAULT_MAX_LENGTH;
    const maxLength = options.maxLength ?? envLimit;

    if (maxLength === 0) {
        return "";
    }

    const highlight = options.highlight ?? shouldHighlight();
    const colors = createColors(highlight);

    let output = "";
    for (const root of roots(container)) {
        output += formatWidget(root, 0, options.getId, colors);
    }

    if (output.length > maxLength) {
        return `${output.slice(0, maxLength)}...`;
    }

    return output.trimEnd();
};

/**
 * Logs the formatted widget tree to the console — the GTK analog of
 * `@testing-library/dom`'s `logDOM`. Accepts a single container/application or
 * an array of them, logging each in turn.
 *
 * @param container - A container/application or an array of them to format and log
 * @param options - Formatting options for length and highlighting
 *
 * @example
 * ```tsx
 * import { logWidget, screen } from "@gtkx/testing";
 *
 * logWidget(await screen.findByRole(Gtk.AccessibleRole.DIALOG));
 * ```
 */
export const logWidget = (container: Container | Container[], options?: PrettyWidgetOptions): void => {
    const containers: Container[] = Array.isArray(container) ? container : [container];
    for (const target of containers) {
        console.log(prettyWidget(target, options));
    }
};
