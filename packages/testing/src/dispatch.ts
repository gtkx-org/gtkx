import type * as Gtk from "@gtkx/gi/gtk";
import { act } from "./act.js";
import { type ControllerConstructor, findController, getOrCreateController } from "./controller.js";

/**
 * Runs `body` inside a single React `act()` wrap.
 *
 * This is the shared act-wrap seam for every interaction helper: callers that perform
 * multi-step widget mutation (gesture drag sequences, selection-model updates, text entry)
 * route through here instead of open-coding `await act(() => …)`.
 *
 * React's `act` re-throws synchronously when `body` throws synchronously, so the `act`
 * call is deferred into the promise chain: any synchronous throw from `body` surfaces as
 * a rejection of the returned promise rather than escaping the caller synchronously,
 * keeping every interaction helper's `Promise<void>` contract intact.
 */
export const runInAct = (body: () => void | PromiseLike<void>): Promise<void> =>
    Promise.resolve()
        .then(() => act(body))
        .then();

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
