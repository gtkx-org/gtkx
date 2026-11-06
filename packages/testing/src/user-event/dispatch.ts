import type * as Gtk from "@gtkx/gi/gtk";
import { type ControllerConstructor, findControllerOwner, getOrCreateControllers } from "./controller.js";
import { wrapPointerEvent } from "./event-wrapper.js";

type ControllerEmit<T extends Gtk.EventController> = (controller: T, owner: Gtk.Widget) => void | PromiseLike<void>;

const emitOnAll = async <T extends Gtk.EventController>(
    owner: Gtk.Widget,
    controllers: T[],
    emit: ControllerEmit<T>,
): Promise<void> => {
    for (const controller of controllers) {
        await emit(controller, owner);
    }
};

const dispatchOnOrCreateControllers = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    controllerType: ControllerConstructor<T>,
    emit: ControllerEmit<T>,
): Promise<void> =>
    wrapPointerEvent(widget, () => emitOnAll(widget, getOrCreateControllers(widget, controllerType), emit));

const dispatchOnControllers = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    controllerType: ControllerConstructor<T>,
    emit: ControllerEmit<T>,
): Promise<void> =>
    wrapPointerEvent(widget, () => {
        const owner = findControllerOwner(widget, controllerType);

        return emitOnAll(owner.widget, owner.controllers, emit);
    });

export { dispatchOnOrCreateControllers, dispatchOnControllers };
