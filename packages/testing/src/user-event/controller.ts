import * as Gtk from "@gtkx/gi/gtk";
import { ancestors } from "../traversal.js";
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

const isEventLimit = (widget: Gtk.Widget): boolean => widget instanceof Gtk.Native || widget.getLimitEvents();

const eventLimitOf = (widget: Gtk.Widget): Gtk.Widget | undefined => [widget, ...ancestors(widget)].find(isEventLimit);

const receivesEventsFor = (owner: Gtk.Widget, limit: Gtk.PropagationLimit, target: Gtk.Widget): boolean =>
    limit === Gtk.PropagationLimit.NONE || eventLimitOf(owner) === eventLimitOf(target);

/** Whether GTK runs a controller of `owner` for an event on `target`: its phase is not none and its limit admits it. */
const runsFor = (controller: Gtk.EventController, owner: Gtk.Widget, target: Gtk.Widget): boolean =>
    controller.getPropagationPhase() !== Gtk.PropagationPhase.NONE &&
    receivesEventsFor(owner, controller.getPropagationLimit(), target);

const findControllerOwner = <T extends Gtk.EventController>(
    target: Gtk.Accessible,
    controllerType: ControllerConstructor<T>,
): ControllerOwner<T> => {
    const origin = requireWidget(target);
    let widget: Gtk.Widget | null = origin;

    while (widget !== null) {
        const owner: Gtk.Widget = widget;
        const controllers = queryAllControllers(owner, controllerType).filter((controller) =>
            runsFor(controller, owner, origin),
        );

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
    receivesEventsFor,
    runsFor,
    type ControllerConstructor,
};
