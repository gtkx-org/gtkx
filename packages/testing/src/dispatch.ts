import type * as Gtk from "@gtkx/gi/gtk";
import { getConfig } from "./config.js";
import { type ControllerConstructor, findController, getOrCreateController } from "./controller.js";

export const runInAct = (body: () => void | PromiseLike<void>): Promise<void> =>
    Promise.resolve().then(async () => {
        let pending: PromiseLike<void> | undefined;
        await getConfig().eventWrapper(() => {
            pending = body() ?? undefined;
        });
        await pending;
    });

type ControllerEmit<T extends Gtk.EventController> = (controller: T) => void | PromiseLike<void>;

export const dispatchOnController = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    controllerType: ControllerConstructor<T>,
    emit: ControllerEmit<T>,
): Promise<void> => runInAct(() => emit(getOrCreateController(widget, controllerType)));

export const dispatchOnExistingController = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    controllerType: ControllerConstructor<T>,
    emit: ControllerEmit<T>,
): Promise<void> => runInAct(() => emit(findController(widget, controllerType)));
