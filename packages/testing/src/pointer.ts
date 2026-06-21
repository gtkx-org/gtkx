import * as Gtk from "@gtkx/gi/gtk";
import { emitPress, emitRelease } from "./click.js";
import { dispatchOnController } from "./dispatch.js";
import type { UserEventState } from "./state.js";

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

export const pointerWith =
    (state: UserEventState) =>
    (widget: Gtk.Widget, input: PointerInput): Promise<void> =>
        dispatchOnController(widget, Gtk.GestureClick, (controller) => applyPointerInput(controller, state, input));
