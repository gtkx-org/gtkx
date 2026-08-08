import type * as Gtk from "@gtkx/gi/gtk";
import type { SerializedWidget } from "@gtkx/mcp/internal";

type WidgetIdResolver = (widget: Gtk.Widget) => string;

type WidgetFormatting = {
    formatRole(role: Gtk.AccessibleRole): string;
    getWidgetText(widget: Gtk.Widget): string | null;
};

const serializeWidget = (
    widget: Gtk.Widget,
    resolveId: WidgetIdResolver,
    testing: WidgetFormatting,
    maxDepth = Infinity,
): SerializedWidget => {
    const children: SerializedWidget[] = [];

    if (maxDepth > 0) {
        let child = widget.getFirstChild();

        while (child) {
            children.push(serializeWidget(child, resolveId, testing, maxDepth - 1));
            child = child.getNextSibling();
        }
    }

    return {
        id: resolveId(widget),
        type: widget.constructor.name,
        role: testing.formatRole(widget.getAccessibleRole()),
        name: widget.getName() || null,
        text: testing.getWidgetText(widget),
        isSensitive: widget.getSensitive(),
        isVisible: widget.getVisible(),
        cssClasses: widget.getCssClasses(),
        children,
    };
};

export { serializeWidget, type WidgetFormatting };
