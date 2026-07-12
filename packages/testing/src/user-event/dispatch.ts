import type * as Gtk from "@gtkx/gi/gtk";
import { type ControllerConstructor, getController, getOrCreateController } from "./controller.js";
import { wrapEvent } from "./event-wrapper.js";

type ControllerEmit<T extends Gtk.EventController> = (controller: T) => void | PromiseLike<void>;

export const dispatchOnOrCreateController = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    controllerType: ControllerConstructor<T>,
    emit: ControllerEmit<T>,
): Promise<void> => wrapEvent(widget, () => emit(getOrCreateController(widget, controllerType)));

export const dispatchOnController = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    controllerType: ControllerConstructor<T>,
    emit: ControllerEmit<T>,
): Promise<void> => wrapEvent(widget, () => emit(getController(widget, controllerType)));
