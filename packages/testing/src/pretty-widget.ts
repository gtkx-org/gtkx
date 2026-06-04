import * as Gtk from "@gtkx/gi/gtk";
import { formatRole } from "./role-helpers.js";
import { type Container, isApplication } from "./traversal.js";
import { getWidgetPropertyText } from "./widget-text.js";

const DEFAULT_MAX_LENGTH = 7000;
const INDENT = "  ";

const debugIdMap = new WeakMap<Gtk.Widget, string>();
let nextDebugId = 0;

const getWidgetDebugId = (widget: Gtk.Widget): string => {
    let id = debugIdMap.get(widget);
    if (!id) {
        id = String(nextDebugId++);
        debugIdMap.set(widget, id);
    }
    return id;
};

/**
 * Options for {@link prettyWidget}.
 */
export type PrettyWidgetOptions = {
    /** Maximum output length before truncation (default: 7000) */
    maxLength?: number;
    /** Enable ANSI color highlighting (default: auto-detect) */
    highlight?: boolean;
    /** Include widget IDs for MCP/agentic interactions (default: false) */
    includeIds?: boolean;
};

const buildAttrs = (widget: Gtk.Widget, includeIds: boolean): ReadonlyArray<readonly [string, string]> => {
    const attrs: [string, string][] = [];

    if (includeIds) {
        attrs.push(["id", getWidgetDebugId(widget)]);
    }

    const name = widget.getName();
    if (name) {
        attrs.push(["name", name]);
    }

    attrs.push(["role", formatRole(widget.getAccessibleRole())]);

    if (!widget.getSensitive()) {
        attrs.push(["aria-disabled", "true"]);
    }

    if (!widget.getVisible()) {
        attrs.push(["aria-hidden", "true"]);
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

const formatWidget = (widget: Gtk.Widget, depth: number, includeIds: boolean, colors: Colors): string => {
    const indent = INDENT.repeat(depth);
    const tag = widget.constructor.name;
    const attrs = formatAttrs(buildAttrs(widget, includeIds), colors);
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
        output += formatWidget(child, depth + 1, includeIds, colors);
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
    const includeIds = options.includeIds ?? false;
    const colors = createColors(highlight);

    let output = "";
    if (isApplication(container)) {
        for (const window of Gtk.Window.listToplevels()) {
            output += formatWidget(window, 0, includeIds, colors);
        }
    } else if (container instanceof Gtk.Widget) {
        output += formatWidget(container, 0, includeIds, colors);
    }

    if (output.length > maxLength) {
        return `${output.slice(0, maxLength)}...`;
    }

    return output.trimEnd();
};
