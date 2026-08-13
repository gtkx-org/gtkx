import * as Gtk from "@gtkx/gi/gtk";
import { sortStringsBy } from "@gtkx/utils";
import { type Config, format, type NewPlugin, type PrettyFormatOptions } from "@vitest/pretty-format";
import { formatRole } from "./role-helpers.js";
import { type Container, descendants, isOnScreen, roots } from "./traversal.js";
import { getWidgetText } from "./widget-accessible-properties.js";
import { getTypeTag } from "./widget-getters.js";

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
    shouldHighlight?: boolean;
    /** Resolves an `id` attribute to show for each widget. */
    getId?: WidgetIdResolver;
    /** Stops descending past this depth, replacing deeper children with a summary line. */
    maxDepth?: number;
    /** Forwarded to pretty-format, which does the printing; `indent` and `min` shape the layout. */
    prettyFormatOptions?: PrettyFormatOptions;
};

type Color = { open: string; close: string };

type FormatContext = {
    getId: WidgetIdResolver | undefined;
    config: Config;
    maxDepth: number | undefined;
};

const DEFAULT_MAX_LENGTH = 7000;

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

    if (!isOnScreen(widget)) {
        attrs.push(["mapped", "false"]);
    }

    const idAttrs = attrs.filter(([key]) => key === "id");

    const otherAttrs = sortStringsBy(
        attrs.filter(([key]) => key !== "id"),
        ([key]) => key,
    );

    return [...idAttrs, ...otherAttrs];
};

const isHighlightSupported = (): boolean => {
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

const paint = (color: Color, text: string): string => `${color.open}${text}${color.close}`;
const escapeAttrValue = (value: string): string => value.replaceAll('"', "&quot;");

const formatAttr = (key: string, value: string, colors: Config["colors"]): string => {
    const quoted = `"${escapeAttrValue(value)}"`;

    return ` ${paint(colors.prop, key)}=${paint(colors.value, quoted)}`;
};

const formatAttrs = (attrs: [string, string][], colors: Config["colors"]): string =>
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

const depthLimitReason = (widget: Gtk.Widget, getId: WidgetIdResolver | undefined): string => {
    const hint = getId ? ` (pass rootId="${getId(widget)}" or raise maxDepth to expand)` : "";

    return `hidden${hint}`;
};

const hasMappedDescendant = (widget: Gtk.Widget): boolean => {
    for (const descendant of descendants(widget)) {
        if (isOnScreen(descendant)) {
            return true;
        }
    }

    return false;
};

const collapseReasonFor = (widget: Gtk.Widget, depth: number, ctx: FormatContext): string | null => {
    if (!widget.getFirstChild()) {
        return null;
    }

    if (!isOnScreen(widget) && !hasMappedDescendant(widget)) {
        return "not mapped";
    }

    if (ctx.maxDepth !== undefined && depth >= ctx.maxDepth) {
        return depthLimitReason(widget, ctx.getId);
    }

    return null;
};

const formatCollapsedChildrenLine = (
    widget: Gtk.Widget,
    indentation: string,
    config: Config,
    reason: string,
): string => {
    const count = countChildren(widget);
    const plural = count === 1 ? "" : "s";
    const summary = `… ${String(count)} child widget${plural} ${reason}`;

    return `${indentation}${config.indent}${paint(config.colors.tag, summary)}${config.spacingOuter}`;
};

const formatChildren = (widget: Gtk.Widget, indentation: string, depth: number, ctx: FormatContext): string => {
    let output = "";
    let child = widget.getFirstChild();

    while (child) {
        output += formatWidget(child, indentation + ctx.config.indent, depth + 1, ctx);
        child = child.getNextSibling();
    }

    return output;
};

const formatBody = (widget: Gtk.Widget, indentation: string, depth: number, ctx: FormatContext): string => {
    const collapseReason = collapseReasonFor(widget, depth, ctx);

    if (collapseReason === null) {
        return formatChildren(widget, indentation, depth, ctx);
    }

    return formatCollapsedChildrenLine(widget, indentation, ctx.config, collapseReason);
};

const formatWidget = (widget: Gtk.Widget, indentation: string, depth: number, ctx: FormatContext): string => {
    const { config } = ctx;
    const tag = getTypeTag(widget);
    const attrs = formatAttrs(buildAttrs(widget, ctx.getId), config.colors);
    const openTag = `${paint(config.colors.tag, "<" + tag)}${attrs}${paint(config.colors.tag, ">")}`;
    const closeTag = paint(config.colors.tag, `</${tag}>`);
    const text = getWidgetText(widget);
    const openLine = `${indentation}${openTag}${config.spacingOuter}`;

    if (!text && !widget.getFirstChild()) {
        return openLine;
    }

    const textLine = text ? `${indentation}${config.indent}${text}${config.spacingOuter}` : "";
    const body = formatBody(widget, indentation, depth, ctx);

    return `${openLine}${textLine}${body}${indentation}${closeTag}${config.spacingOuter}`;
};

const createWidgetPlugin = (options: PrettyWidgetOptions): NewPlugin => ({
    test: (value: unknown): boolean => value instanceof Gtk.Widget,
    serialize: (widget: Gtk.Widget, config: Config, indentation: string): string =>
        formatWidget(widget, indentation, 0, { getId: options.getId, config, maxDepth: options.maxDepth }),
});

const resolveMaxLength = (options: PrettyWidgetOptions): number => {
    const envLimit = process.env.DEBUG_PRINT_LIMIT ? Number(process.env.DEBUG_PRINT_LIMIT) : DEFAULT_MAX_LENGTH;

    return options.maxLength ?? envLimit;
};

const formatOptions = (options: PrettyWidgetOptions): PrettyFormatOptions => {
    const { plugins, ...rest } = options.prettyFormatOptions ?? {};

    return {
        highlight: options.shouldHighlight ?? isHighlightSupported(),
        ...rest,
        plugins: [createWidgetPlugin(options), ...(plugins ?? [])],
    };
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

    const prettyFormatOptions = formatOptions(options);
    let output = "";

    for (const root of roots(container)) {
        output += format(root, prettyFormatOptions);
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

export { logWidget, prettyWidget, type PrettyWidgetOptions };
