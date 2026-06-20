import * as Gtk from "@gtkx/gi/gtk";

/**
 * Per-client mapping between live `Gtk.Widget` instances and stable string
 * IDs used over the MCP wire.
 *
 * IDs are assigned the first time a widget is seen, cached in a `WeakMap`
 * so widget garbage collection releases the slot, and surfaced through a
 * regular `Map` so reverse lookups by ID work for the lifetime of the
 * registry. Each `McpClient` owns its own registry so two clients in one
 * process cannot collide on IDs.
 *
 * The registry owns only widget identity; projecting a widget into the wire
 * shape is the stateless `serializeWidget` free function.
 */
export class WidgetRegistry {
    private readonly idByWidget = new WeakMap<Gtk.Widget, string>();
    private nextId = 0;
    private readonly widgetById = new Map<string, Gtk.Widget>();
    private topLevelWindows: Gtk.Window[] = [];

    /**
     * Drops every reverse-lookup entry and re-registers the current
     * top-level windows and their descendants, retaining the toplevel set for
     * {@link toplevels}.
     */
    refresh(): void {
        this.widgetById.clear();
        this.topLevelWindows = Gtk.Window.listToplevels() as Gtk.Window[];
        for (const window of this.topLevelWindows) {
            this.register(window);
        }
    }

    /**
     * The top-level windows captured by the most recent {@link refresh}.
     */
    toplevels(): Gtk.Window[] {
        return this.topLevelWindows;
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
}
