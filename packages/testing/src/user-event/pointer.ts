import * as Gtk from "@gtkx/gi/gtk";
import type { UserEventState } from "./state.js";
import { emitPress, emitRelease } from "./click.js";
import { getOrCreateControllers } from "./controller.js";
import { wrapEvent } from "./event-wrapper.js";

/**
 * A pointer action token: a full click (`click`, `[MouseLeft]`), a button press (`down`,
 * `[MouseLeft>]`), or a button release (`up`, `[/MouseLeft]`).
 */
type PointerInput = "click" | "down" | "up" | "[MouseLeft]" | "[MouseLeft>]" | "[/MouseLeft]";

const PRESS_INPUTS: Set<PointerInput> = new Set(["[MouseLeft>]", "down"]);
const RELEASE_INPUTS: Set<PointerInput> = new Set(["[/MouseLeft]", "up"]);
const CLICK_INPUTS: Set<PointerInput> = new Set(["[MouseLeft]", "click"]);

const applyPointerInput = (widget: Gtk.Widget, state: UserEventState, input: PointerInput): void => {
    const controllers = getOrCreateControllers(widget, Gtk.GestureClick);

    if (CLICK_INPUTS.has(input)) {
        emitPress(widget, controllers, 1);
        emitRelease(widget, controllers, 1);
        state.mouseLeftDown = false;

        return;
    }

    if (PRESS_INPUTS.has(input) && !state.mouseLeftDown) {
        emitPress(widget, controllers, 1);
        state.mouseLeftDown = true;

        return;
    }

    if (RELEASE_INPUTS.has(input) && state.mouseLeftDown) {
        emitRelease(widget, controllers, 1);
        state.mouseLeftDown = false;
    }
};

const pointer = (state: UserEventState, widget: Gtk.Widget, input: PointerInput): Promise<void> =>
    wrapEvent(widget, () => {
        applyPointerInput(widget, state, input);
    });

export { pointer, type PointerInput };
