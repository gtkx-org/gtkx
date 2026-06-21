import type * as Gtk from "@gtkx/gi/gtk";
import { getConfig } from "./config.js";
import { type ControllerConstructor, findController, getOrCreateController } from "./controller.js";

/**
 * Runs `body` inside the configured event wrapper (React `act()` by default).
 *
 * This is the shared event-wrap seam for every interaction helper: callers that perform
 * multi-step widget mutation (gesture drag sequences, selection-model updates, text entry)
 * route through here instead of open-coding `await act(() => …)`.
 *
 * The wrapper invocation is deferred into the promise chain, so any synchronous throw from
 * `body` surfaces as a rejection of the returned promise rather than escaping the caller
 * synchronously, keeping every interaction helper's `Promise<void>` contract intact. When
 * `body` returns a thenable, both the wrapper and the body are awaited.
 */
export const runInAct = (body: () => void | PromiseLike<void>): Promise<void> =>
    Promise.resolve().then(async () => {
        let pending: PromiseLike<void> | undefined;
        await getConfig().eventWrapper(() => {
            pending = body() ?? undefined;
        });
        await pending;
    });

type ControllerEmit<T extends Gtk.EventController> = (controller: T) => void | PromiseLike<void>;

/**
 * Emits on a controller of `controllerType`, attaching one to `widget` if absent, inside a
 * single `act()` wrap.
 *
 * Use this for interactions whose controller is created on demand (click, pointer, hover).
 * When `emit` returns a thenable it is awaited inside the same `act()` scope.
 */
export const dispatchOnController = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    controllerType: ControllerConstructor<T>,
    emit: ControllerEmit<T>,
): Promise<void> => runInAct(() => emit(getOrCreateController(widget, controllerType)));

/**
 * Emits on a controller of `controllerType` that must already be attached to `widget`,
 * inside a single `act()` wrap, throwing when no such controller exists.
 *
 * Use this for gesture interactions that require a pre-attached controller (rotate, zoom,
 * swipe, long press). When `emit` returns a thenable it is awaited inside the same `act()`
 * scope.
 */
export const dispatchOnExistingController = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    controllerType: ControllerConstructor<T>,
    emit: ControllerEmit<T>,
): Promise<void> => runInAct(() => emit(findController(widget, controllerType)));
