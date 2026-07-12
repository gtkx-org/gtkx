import * as Gtk from "@gtkx/gi/gtk";
import { emitPress, emitRelease } from "./click.js";
import { dispatchOnOrCreateController } from "./dispatch.js";
import type { UserEventState } from "./state.js";

/** A pointer action token: a full click (`click`, `[MouseLeft]`), a button press (`down`, `[MouseLeft>]`), or a button release (`up`, `[/MouseLeft]`). */
export type PointerInput = "click" | "down" | "up" | "[MouseLeft]" | "[MouseLeft>]" | "[/MouseLeft]";

const PRESS_INPUTS = new Set<PointerInput>(["[MouseLeft>]", "down"]);
const RELEASE_INPUTS = new Set<PointerInput>(["[/MouseLeft]", "up"]);
const CLICK_INPUTS = new Set<PointerInput>(["[MouseLeft]", "click"]);

const applyPointerInput = (controller: Gtk.GestureClick, state: UserEventState, input: PointerInput): void => {
    if (CLICK_INPUTS.has(input)) {
        emitPress(controller, 1);
        emitRelease(controller, 1);
        state.mouseLeftDown = false;
        return;
    }
    if (PRESS_INPUTS.has(input) && !state.mouseLeftDown) {
        emitPress(controller, 1);
        state.mouseLeftDown = true;
        return;
    }
    if (RELEASE_INPUTS.has(input) && state.mouseLeftDown) {
        emitRelease(controller, 1);
        state.mouseLeftDown = false;
    }
};

/**
 * Applies a low-level pointer action (click, press, or release) to the widget, tracking left-button state across calls.
 * @param state Accumulated pointer button state shared across calls.
 * @param widget Widget receiving the pointer action.
 * @param input Pointer action token to apply.
 */
export const pointer = (state: UserEventState, widget: Gtk.Widget, input: PointerInput): Promise<void> =>
    dispatchOnOrCreateController(widget, Gtk.GestureClick, (controller) => applyPointerInput(controller, state, input));
