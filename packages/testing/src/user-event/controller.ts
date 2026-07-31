import type * as Gtk from "@gtkx/gi/gtk";

/** An event controller class that can be constructed without arguments, such as `Gtk.GestureClick`. */
type ControllerConstructor<T extends Gtk.EventController> = new () => T;

/**
 * Returns every controller of the given type attached to a widget, in the order GTK4 reports them.
 *
 * @param widget The widget whose controllers are inspected.
 * @param controllerType The controller class to match.
 * @returns The matching controllers, or an empty array when the widget has none.
 */
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

/**
 * Returns the first controller of the given type attached to a widget.
 *
 * @param widget The widget whose controllers are inspected.
 * @param controllerType The controller class to match.
 * @returns The first matching controller, or null when the widget has none.
 */
const queryController = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    controllerType: ControllerConstructor<T>,
): T | null => queryAllControllers(widget, controllerType)[0] ?? null;

/**
 * Returns every controller of the given type attached to a widget.
 *
 * @param widget The widget whose controllers are inspected.
 * @param controllerType The controller class to match.
 * @throws When the widget has no controller of that type.
 */
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

/**
 * Returns the first controller of the given type attached to a widget.
 *
 * @param widget The widget whose controllers are inspected.
 * @param controllerType The controller class to match.
 * @throws When the widget has no controller of that type.
 */
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
