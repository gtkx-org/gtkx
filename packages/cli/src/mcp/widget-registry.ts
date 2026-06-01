import * as Gtk from "@gtkx/gi/gtk";
import type { SerializedWidget } from "@gtkx/mcp";
import { reverseNumericEnum } from "@gtkx/utils";

const ROLE_NAMES_BY_VALUE = reverseNumericEnum(Gtk.AccessibleRole);

const formatRole = (role: Gtk.AccessibleRole | undefined): string => {
    if (role === undefined) return "UNKNOWN";
    return ROLE_NAMES_BY_VALUE.get(role) ?? String(role);
};

const getWidgetText = (widget: Gtk.Widget): string | null => {
    if ("getLabel" in widget && typeof widget.getLabel === "function") {
        return widget.getLabel() ?? null;
    }
    if ("getText" in widget && typeof widget.getText === "function") {
        return widget.getText() ?? null;
    }
    if ("getTitle" in widget && typeof widget.getTitle === "function") {
        return widget.getTitle() ?? null;
    }
    return null;
};

/**
 * Per-client mapping between live `Gtk.Widget` instances and stable string
 * IDs used over the MCP wire.
 *
 * IDs are assigned the first time a widget is seen, cached in a `WeakMap`
 * so widget garbage collection releases the slot, and surfaced through a
 * regular `Map` so reverse lookups by ID work for the lifetime of the
 * registry. Each `McpClient` owns its own registry so two clients in one
 * process cannot collide on IDs.
 */
export class WidgetRegistry {
    private readonly idByWidget = new WeakMap<Gtk.Widget, string>();
    private nextId = 0;
    private readonly widgetById = new Map<string, Gtk.Widget>();

    /**
     * Drops every reverse-lookup entry and re-registers the current
     * top-level windows and their descendants.
     */
    refresh(): void {
        this.widgetById.clear();
        for (const window of Gtk.Window.listToplevels()) {
            this.register(window);
        }
    }

    /**
     * Registers `widget` and its entire descendant tree.
     *
     * @param widget - The widget to register.
     */
    register(widget: Gtk.Widget): void {
        const id = this.idFor(widget);
        this.widgetById.set(id, widget);
        let child = widget.getFirstChild();
        while (child) {
            this.register(child);
            child = child.getNextSibling();
        }
    }

    /**
     * Returns the stable ID for `widget`, assigning a fresh one on first
     * sight.
     *
     * @param widget - The widget to identify.
     */
    idFor(widget: Gtk.Widget): string {
        let id = this.idByWidget.get(widget);
        if (!id) {
            id = String(this.nextId++);
            this.idByWidget.set(widget, id);
        }
        return id;
    }

    /**
     * Reverse-lookup: returns the widget for an ID previously assigned by
     * this registry, or `undefined` if the widget is no longer alive in the
     * current tree.
     *
     * @param id - A widget ID.
     */
    get(id: string): Gtk.Widget | undefined {
        return this.widgetById.get(id);
    }

    /**
     * Renders a widget (and its descendants) into the wire format consumed
     * by MCP clients.
     *
     * @param widget - The widget to serialize.
     */
    serialize(widget: Gtk.Widget): SerializedWidget {
        const children: SerializedWidget[] = [];
        let child = widget.getFirstChild();
        while (child) {
            children.push(this.serialize(child));
            child = child.getNextSibling();
        }

        const text = getWidgetText(widget);

        return {
            id: this.idFor(widget),
            type: widget.constructor.name,
            role: formatRole(widget.getAccessibleRole()),
            name: widget.getName() || null,
            label: text,
            text,
            sensitive: widget.getSensitive(),
            visible: widget.getVisible(),
            cssClasses: widget.getCssClasses() ?? [],
            children,
        };
    }
}
