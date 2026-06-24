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

const controllerCache = new WeakMap<
    Gtk.Widget,
    Map<ControllerConstructor<Gtk.EventController>, Gtk.EventController>
>();

export const getOrCreateController = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    controllerType: ControllerConstructor<T>,
): T => {
    let perWidget = controllerCache.get(widget);
    const cached = perWidget?.get(controllerType);
    if (cached instanceof controllerType) return cached;

    const existing = queryController(widget, controllerType);
    const controller = existing ?? new controllerType();
    if (!existing) widget.addController(controller);

    if (!perWidget) {
        perWidget = new Map();
        controllerCache.set(widget, perWidget);
    }
    perWidget.set(controllerType, controller);
    return controller;
};
