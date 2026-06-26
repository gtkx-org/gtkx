import * as Gtk from "@gtkx/gi/gtk";

export class WidgetRegistry {
    private idByWidget = new WeakMap<Gtk.Widget, string>();
    private nextId = 0;
    private widgetById = new Map<string, Gtk.Widget>();
    private toplevelWindows: Gtk.Window[] = [];

    refresh(): void {
        this.widgetById.clear();
        this.toplevelWindows = Gtk.Window.listToplevels() as Gtk.Window[];
        for (const window of this.toplevelWindows) {
            this.register(window);
        }
    }

    toplevels(): Gtk.Window[] {
        return this.toplevelWindows;
    }

    register(widget: Gtk.Widget): void {
        const id = this.idFor(widget);
        this.widgetById.set(id, widget);
        let child = widget.getFirstChild();
        while (child) {
            this.register(child);
            child = child.getNextSibling();
        }
    }

    idFor(widget: Gtk.Widget): string {
        let id = this.idByWidget.get(widget);
        if (!id) {
            id = String(this.nextId++);
            this.idByWidget.set(widget, id);
        }
        return id;
    }

    get(id: string): Gtk.Widget | undefined {
        return this.widgetById.get(id);
    }
}
