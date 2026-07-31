import type * as Gtk from "@gtkx/gi/gtk";

type ControllerConstructor<T extends Gtk.EventController> = new () => T;

const queryAllControllers = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    controllerType: ControllerConstructor<T>,
): T[] => {
    const controllers = widget.observeControllers();
    const nItems = controllers.getNItems();
    const matches: T[] = [];

    for (let i = 0; i < nItems; i++) {
        const controller = controllers.getItem(i);

        if (controller instanceof controllerType) {
            matches.push(controller);
        }
    }

    return matches;
};

const queryController = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    controllerType: ControllerConstructor<T>,
): T | null => queryAllControllers(widget, controllerType)[0] ?? null;

const getAllControllers = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    controllerType: ControllerConstructor<T>,
): T[] => {
    const controllers = queryAllControllers(widget, controllerType);

    if (controllers.length === 0) {
        throw new Error(`No ${controllerType.name} controller is attached to the widget`);
    }

    return controllers;
};

const getController = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    controllerType: ControllerConstructor<T>,
): T => {
    const [controller] = getAllControllers(widget, controllerType);

    if (controller === undefined) {
        throw new Error(`No ${controllerType.name} controller is attached to the widget`);
    }

    return controller;
};

const getOrCreateControllers = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    controllerType: ControllerConstructor<T>,
): T[] => {
    const existing = queryAllControllers(widget, controllerType);

    if (existing.length > 0) {
        return existing;
    }

    const controller = new controllerType();
    widget.addController(controller);

    return [controller];
};

export {
    queryAllControllers,
    queryController,
    getAllControllers,
    getController,
    getOrCreateControllers,
    type ControllerConstructor,
};
