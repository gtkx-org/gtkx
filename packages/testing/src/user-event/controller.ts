import type * as Gtk from "@gtkx/gi/gtk";

export type ControllerConstructor<T extends Gtk.EventController> = new () => T;

export const queryController = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    controllerType: ControllerConstructor<T>,
): T | null => {
    const controllers = widget.observeControllers();
    const nItems = controllers.getNItems();
    for (let i = 0; i < nItems; i++) {
        const controller = controllers.getItem(i);
        if (controller instanceof controllerType) return controller;
    }
    return null;
};

export const getController = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    controllerType: ControllerConstructor<T>,
): T => {
    const controller = queryController(widget, controllerType);
    if (!controller) {
        throw new Error(`No ${controllerType.name} controller is attached to the widget`);
    }
    return controller;
};

export const getOrCreateController = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    controllerType: ControllerConstructor<T>,
): T => {
    const existing = queryController(widget, controllerType);
    if (existing) return existing;
    const controller = new controllerType();
    widget.addController(controller);
    return controller;
};
