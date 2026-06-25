import type * as Gtk from "@gtkx/gi/gtk";
import type { SerializedWidget } from "@gtkx/mcp";

type WidgetIdResolver = (widget: Gtk.Widget) => string;

export type WidgetFormatting = {
    formatRole(role: Gtk.AccessibleRole): string;
    getWidgetNodeText(widget: Gtk.Widget): string | null;
};

export const serializeWidget = (
    widget: Gtk.Widget,
    idFor: WidgetIdResolver,
    testing: WidgetFormatting,
): SerializedWidget => {
    const children: SerializedWidget[] = [];
    let child = widget.getFirstChild();
    while (child) {
        children.push(serializeWidget(child, idFor, testing));
        child = child.getNextSibling();
    }

    return {
        id: idFor(widget),
        type: widget.constructor.name,
        role: testing.formatRole(widget.getAccessibleRole()),
        name: widget.getName() || null,
        text: testing.getWidgetNodeText(widget),
        sensitive: widget.getSensitive(),
        visible: widget.getVisible(),
        cssClasses: widget.getCssClasses() ?? [],
        children,
    };
};
