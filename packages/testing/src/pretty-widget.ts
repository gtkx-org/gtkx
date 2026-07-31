import type * as Gtk from "@gtkx/gi/gtk";
import { sortStringsBy } from "@gtkx/utils";
import { formatRole } from "./role-helpers.js";
import { type Container, roots } from "./traversal.js";
import { getWidgetNodeText } from "./widget-accessible-properties.js";

/** Produces the value of the `id` attribute printed first on a widget's opening tag. */
type WidgetIdResolver = (widget: Gtk.Widget) => string;

/**
 * Options controlling how a widget tree is rendered to a string by
 * {@link prettyWidget} and {@link logWidget}.
 */
type PrettyWidgetOptions = {
    /** Truncates the output once it exceeds this many characters. */
    maxLength?: number;
    /** Whether to apply ANSI color highlighting; defaults to the terminal capabilities. */
    highlight?: boolean;
    /** Resolves an `id` attribute to show for each widget. */
    getId?: WidgetIdResolver;
    /** Stops descending past this depth, replacing deeper children with a summary line. */
    maxDepth?: number;
};

type Colors = {
    tag: (s: string) => string;
    attr: (s: string) => string;
    value: (s: string) => string;
};

type FormatContext = {
    getId: WidgetIdResolver | undefined;
    colors: Colors;
    maxDepth: number | undefined;
};

const DEFAULT_MAX_LENGTH = 7000;
const INDENT = "  ";

const ansi = {
    cyan: "\u{1B}[36m",
    yellow: "\u{1B}[33m",
    green: "\u{1B}[32m",
    reset: "\u{1B}[0m",
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

const shouldHighlight = (): boolean => {
    if (typeof process === "undefined") {
        return false;
    }

    if (process.env.COLORS === "false" || process.env.NO_COLOR) {
        return false;
    }

    if (process.env.COLORS === "true" || process.env.FORCE_COLOR) {
        return true;
    }

    return process.stdout.isTTY;
};

const createColors = (isEnabled: boolean): Colors => {
    if (!isEnabled) {
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

const formatAttr = (key: string, value: string, colors: Colors): string => {
    const quoted = `"${escapeAttrValue(value)}"`;

    return ` ${colors.attr(key)}=${colors.value(quoted)}`;
};

const formatAttrs = (attrs: [string, string][], colors: Colors): string =>
    attrs.map(([key, value]) => formatAttr(key, value, colors)).join("");

const countChildren = (widget: Gtk.Widget): number => {
    let count = 0;
    let child = widget.getFirstChild();

    while (child) {
        count += 1;
        child = child.getNextSibling();
    }

    return count;
};

const formatHiddenChildrenLine = (widget: Gtk.Widget, depth: number, ctx: FormatContext): string => {
    const { getId, colors } = ctx;
    const indent = INDENT.repeat(depth);
    const count = countChildren(widget);
    const hint = getId ? ` (pass rootId="${getId(widget)}" or raise maxDepth to expand)` : "";
    const plural = count === 1 ? "" : "s";
    const summary = `… ${String(count)} child widget${plural} hidden${hint}`;

    return `${indent}${INDENT}${colors.tag(summary)}\n`;
};

const formatChildren = (widget: Gtk.Widget, depth: number, ctx: FormatContext): string => {
    let output = "";
    let child = widget.getFirstChild();

    while (child) {
        output += formatWidget(child, depth + 1, ctx);
        child = child.getNextSibling();
    }

    return output;
};

const formatWidget = (widget: Gtk.Widget, depth: number, ctx: FormatContext): string => {
    const { getId, colors, maxDepth } = ctx;
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

    if (firstChild && maxDepth !== undefined && depth >= maxDepth) {
        output += formatHiddenChildrenLine(widget, depth, ctx);
        output += `${indent}${closeTag}\n`;

        return output;
    }

    output += formatChildren(widget, depth, ctx);
    output += `${indent}${closeTag}\n`;

    return output;
};

const resolveMaxLength = (options: PrettyWidgetOptions): number => {
    const envLimit = process.env.DEBUG_PRINT_LIMIT ? Number(process.env.DEBUG_PRINT_LIMIT) : DEFAULT_MAX_LENGTH;

    return options.maxLength ?? envLimit;
};

/**
 * Renders a widget tree as an indented, HTML-like string showing each widget's
 * tag, accessible attributes, and text content.
 *
 * @param container The scope whose widget tree is formatted.
 * @param options Formatting options such as truncation length and highlighting.
 * @returns The formatted representation of the tree.
 */
const prettyWidget = (container: Container, options: PrettyWidgetOptions = {}): string => {
    const maxLength = resolveMaxLength(options);

    if (maxLength === 0) {
        return "";
    }

    const isHighlight = options.highlight ?? shouldHighlight();
    const colors = createColors(isHighlight);
    let output = "";

    for (const root of roots(container)) {
        output += formatWidget(root, 0, { getId: options.getId, colors, maxDepth: options.maxDepth });
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
const logWidget = (container: Container | Container[], options?: PrettyWidgetOptions): void => {
    const containers: Container[] = Array.isArray(container) ? container : [container];

    for (const target of containers) {
        console.log(prettyWidget(target, options));
    }
};

export { prettyWidget, logWidget, type PrettyWidgetOptions };
