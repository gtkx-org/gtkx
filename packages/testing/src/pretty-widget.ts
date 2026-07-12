import type * as Gtk from "@gtkx/gi/gtk";
import { sortStringsBy } from "@gtkx/utils";
import { formatRole } from "./role-helpers.js";
import { type Container, roots } from "./traversal.js";
import { getWidgetNodeText } from "./widget-accessible-properties.js";

const DEFAULT_MAX_LENGTH = 7000;
const INDENT = "  ";

type WidgetIdResolver = (widget: Gtk.Widget) => string;

/**
 * Options controlling how a widget tree is rendered to a string by
 * {@link prettyWidget} and {@link logWidget}.
 */
export type PrettyWidgetOptions = {
    /** Truncates the output once it exceeds this many characters. */
    maxLength?: number;
    /** Whether to apply ANSI color highlighting; defaults to the terminal capabilities. */
    highlight?: boolean;
    /** Resolves an `id` attribute to show for each widget. */
    getId?: WidgetIdResolver;
};

const buildAttrs = (widget: Gtk.Widget, getId: WidgetIdResolver | undefined): [string, string][] => {
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

    const idAttrs = attrs.filter(([key]) => key === "id");
    const otherAttrs = sortStringsBy(
        attrs.filter(([key]) => key !== "id"),
        ([key]) => key,
    );
    return [...idAttrs, ...otherAttrs];
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
    return process.stdout.isTTY;
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

const formatAttrs = (attrs: [string, string][], colors: Colors): string =>
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

    const text = getWidgetNodeText(widget);
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
 * Renders a widget tree as an indented, HTML-like string showing each widget's
 * tag, accessible attributes, and text content.
 *
 * @param container The scope whose widget tree is formatted.
 * @param options Formatting options such as truncation length and highlighting.
 * @returns The formatted representation of the tree.
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
 * Prints one or more widget trees to the console using {@link prettyWidget}.
 *
 * @param container A single scope or an array of scopes to format and print.
 * @param options Formatting options passed through to {@link prettyWidget}.
 */
export const logWidget = (container: Container | Container[], options?: PrettyWidgetOptions): void => {
    const containers: Container[] = Array.isArray(container) ? container : [container];
    for (const target of containers) {
        console.log(prettyWidget(target, options));
    }
};
