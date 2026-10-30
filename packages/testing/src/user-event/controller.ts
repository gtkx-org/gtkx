import type * as Gtk from "@gtkx/gi/gtk";
import { requireWidget } from "../widget-target.js";
import { usageError } from "../usage-error.js";

/** An event controller class that can be constructed without arguments, such as `Gtk.GestureClick`. */
type ControllerConstructor<T extends Gtk.EventController> = new () => T;

/**
 * Returns every controller of the given type attached to a widget, in the order GTK4 reports them.
 *
 * @param target The widget whose controllers are inspected.
 * @param controllerType The controller class to match.
 * @returns The matching controllers, or an empty array when the widget has none.
 */
const queryAllControllers = <T extends Gtk.EventController>(
    target: Gtk.Accessible,
    controllerType: ControllerConstructor<T>,
): T[] => {
    const widget = requireWidget(target);
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
    widget: Gtk.Accessible,
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
    widget: Gtk.Accessible,
    controllerType: ControllerConstructor<T>,
): T[] => {
    const controllers = queryAllControllers(widget, controllerType);

    if (controllers.length === 0) {
        throw usageError(new Error(`No ${controllerType.name} controller is attached to the widget`));
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
    widget: Gtk.Accessible,
    controllerType: ControllerConstructor<T>,
): T => {
    const controller = queryController(widget, controllerType);

    if (controller === null) {
        throw usageError(new Error(`No ${controllerType.name} controller is attached to the widget`));
    }

    return controller;
};

type ControllerOwner<T extends Gtk.EventController> = {
    widget: Gtk.Widget;
    controllers: T[];
};

const findControllerOwner = <T extends Gtk.EventController>(
    target: Gtk.Accessible,
    controllerType: ControllerConstructor<T>,
): ControllerOwner<T> => {
    let widget: Gtk.Widget | null = requireWidget(target);

    while (widget !== null) {
        const controllers = queryAllControllers(widget, controllerType);

        if (controllers.length > 0) {
            return { widget, controllers };
        }

        widget = widget.getParent();
    }

    throw usageError(new Error(`No ${controllerType.name} controller is attached to the widget or its ancestors`));
};

const getOrCreateControllers = <T extends Gtk.EventController>(
    target: Gtk.Accessible,
    controllerType: ControllerConstructor<T>,
): T[] => {
    const widget = requireWidget(target);
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
    findControllerOwner,
    type ControllerConstructor,
};
