import type * as Gtk from "@gtkx/gi/gtk";
import type { UserEventState } from "./state.js";
import { clickGestures, emitClickPhase } from "./click.js";
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
    const controllers = clickGestures(widget);

    if (CLICK_INPUTS.has(input)) {
        emitClickPhase(widget, controllers, 1, "pressed");
        emitClickPhase(widget, controllers, 1, "released");
        state.isMouseLeftDown = false;

        return;
    }

    if (PRESS_INPUTS.has(input) && !state.isMouseLeftDown && controllers.length > 0) {
        emitClickPhase(widget, controllers, 1, "pressed");
        state.isMouseLeftDown = true;

        return;
    }

    if (RELEASE_INPUTS.has(input) && state.isMouseLeftDown) {
        emitClickPhase(widget, controllers, 1, "released");
        state.isMouseLeftDown = false;
    }
};

const pointer = (state: UserEventState, widget: Gtk.Widget, input: PointerInput): Promise<void> =>
    wrapEvent(widget, () => {
        applyPointerInput(widget, state, input);
    });

export { pointer, type PointerInput };
