import type * as Gtk from "@gtkx/gi/gtk";
import { type ControllerConstructor, getAllControllers, getOrCreateControllers } from "./controller.js";
import { wrapEvent } from "./event-wrapper.js";

type ControllerEmit<T extends Gtk.EventController> = (controller: T) => void | PromiseLike<void>;

const emitOnAll = async <T extends Gtk.EventController>(controllers: T[], emit: ControllerEmit<T>): Promise<void> => {
    for (const controller of controllers) {
        await emit(controller);
    }
};

const dispatchOnOrCreateControllers = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    controllerType: ControllerConstructor<T>,
    emit: ControllerEmit<T>,
): Promise<void> => wrapEvent(widget, () => emitOnAll(getOrCreateControllers(widget, controllerType), emit));

const dispatchOnControllers = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    controllerType: ControllerConstructor<T>,
    emit: ControllerEmit<T>,
): Promise<void> => wrapEvent(widget, () => emitOnAll(getAllControllers(widget, controllerType), emit));

export { dispatchOnOrCreateControllers, dispatchOnControllers };
