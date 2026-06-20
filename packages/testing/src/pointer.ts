import * as Gtk from "@gtkx/gi/gtk";
import { act } from "./act.js";
import { emitPress, emitRelease } from "./click.js";
import { getOrCreateController } from "./controller.js";
import type { UserEventState } from "./state.js";

/**
 * Pointer input actions for simulating mouse interactions.
 *
 * - `"click"` or `"[MouseLeft]"`: Full click (press + release)
 * - `"down"` or `"[MouseLeft>]"`: Press and hold
 * - `"up"` or `"[/MouseLeft]"`: Release
 */
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
 * Builds a `pointer` helper bound to a shared pointer-down state, so a held
 * press persists across calls within one user-event instance.
 *
 * Supports: `"click"`, `"[MouseLeft]"`, `"down"`, `"up"`.
 *
 * @example
 * ```tsx
 * await userEvent.pointer(widget, "click");
 * await userEvent.pointer(widget, "[MouseLeft]");
 * ```
 */
export const pointerWith =
    (state: UserEventState) =>
    async (widget: Gtk.Widget, input: PointerInput): Promise<void> => {
        await act(() => {
            const controller = getOrCreateController(widget, Gtk.GestureClick);
            applyPointerInput(controller, state, input);
        });
    };
