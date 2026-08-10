import { WidgetRegistry } from "@gtkx/cli/internal";
import * as Gtk from "@gtkx/gi/gtk";
import { applicationProps } from "../helpers/application.js";

type DispatchContext = { app: Gtk.Application; registry: WidgetRegistry };

const contextFor = (widget?: Gtk.Widget): DispatchContext => {
    const registry = new WidgetRegistry();
    registry.refresh();

    if (widget) {
        registry.register(widget);
    }

    return { app: new Gtk.Application(applicationProps()), registry };
};

export { contextFor };
