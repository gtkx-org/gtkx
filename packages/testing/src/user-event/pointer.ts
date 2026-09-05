import type * as Gtk from "@gtkx/gi/gtk";
import type { UserEventState } from "./state.js";
import { type DirectClick, directClickFor, emitClickPhase } from "./click.js";
import { wrapEvent } from "./event-wrapper.js";
import { isClickTransparent } from "./native-click.js";

/**
 * A pointer action token: a full click (`click`, `[MouseLeft]`), a button press (`down`,
 * `[MouseLeft>]`), or a button release (`up`, `[/MouseLeft]`).
 */
type PointerInput = "click" | "down" | "up" | "[MouseLeft]" | "[MouseLeft>]" | "[/MouseLeft]";
type PointerTarget = { widget: Gtk.Widget; click: DirectClick };

const PRESS_INPUTS: Set<PointerInput> = new Set(["[MouseLeft>]", "down"]);
const RELEASE_INPUTS: Set<PointerInput> = new Set(["[/MouseLeft]", "up"]);
const CLICK_INPUTS: Set<PointerInput> = new Set(["[MouseLeft]", "click"]);

const pointerWidgetFor = (widget: Gtk.Widget): Gtk.Widget => {
    let current = widget;

    while (isClickTransparent(current)) {
        const parent = current.getParent();

        if (parent === null) {
            return current;
        }

        current = parent;
    }

    return current;
};

const pointerTargetFor = (widget: Gtk.Widget): PointerTarget => {
    const target = pointerWidgetFor(widget);

    return { widget: target, click: directClickFor(target) };
};

const pressPointer = ({ widget, click }: PointerTarget): void => {
    emitClickPhase(widget, click.gestures, 1, "pressed");
};

const releasePointer = ({ widget, click }: PointerTarget): void => {
    emitClickPhase(widget, click.gestures, 1, "released");
    click.outcome?.(widget, 1);
};

const isPointerPressable = (target: PointerTarget): boolean =>
    target.click.outcome !== null || target.click.gestures.length > 0;

const applyPointerInput = (widget: Gtk.Widget, state: UserEventState, input: PointerInput): void => {
    const target = pointerTargetFor(widget);

    if (CLICK_INPUTS.has(input)) {
        pressPointer(target);
        releasePointer(target);
        state.isMouseLeftDown = false;

        return;
    }

    if (PRESS_INPUTS.has(input) && !state.isMouseLeftDown && isPointerPressable(target)) {
        pressPointer(target);
        state.isMouseLeftDown = true;

        return;
    }

    if (RELEASE_INPUTS.has(input) && state.isMouseLeftDown) {
        releasePointer(target);
        state.isMouseLeftDown = false;
    }
};

const pointer = (state: UserEventState, widget: Gtk.Widget, input: PointerInput): Promise<void> =>
    wrapEvent(widget, () => {
        applyPointerInput(widget, state, input);
    });

export { pointer, type PointerInput };
