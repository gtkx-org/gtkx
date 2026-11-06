import * as Gdk from "@gtkx/gi/gdk";
import type * as Gtk from "@gtkx/gi/gtk";
import { usageError } from "../usage-error.js";
import type { UserEventState } from "./state.js";
import { buttonSitesFor, type ClickSite, type DirectClick, directClickFor, emitSitePhase } from "./click.js";
import { wrapPointerEvent } from "./event-wrapper.js";
import { isClickTransparent } from "./native-click.js";

/**
 * A pointer action token, as in Testing Library: a full click (`[MouseLeft]`, `[MouseRight]`, `[MouseMiddle]`), a
 * button press (`[MouseLeft>]`) or a button release (`[/MouseLeft]`). `click`, `down` and `up` are the left button.
 * The left button clicks the widget as `click` does; the right and middle buttons reach only the click gestures
 * listening for them, such as a `GtkGestureClick` with `button={Gdk.BUTTON_SECONDARY}` that opens a context menu.
 */
type PointerInput =
    | "click"
    | "down"
    | "up"
    | `[Mouse${"Left" | "Middle" | "Right"}]`
    | `[Mouse${"Left" | "Middle" | "Right"}>]`
    | `[/Mouse${"Left" | "Middle" | "Right"}]`;
type PointerAction = "click" | "press" | "release";
type PointerToken = { action: PointerAction; button: number };
type PointerTarget = { widget: Gtk.Widget; click: DirectClick };

const BUTTONS: Record<string, number> = {
    Left: Gdk.BUTTON_PRIMARY,
    Middle: Gdk.BUTTON_MIDDLE,
    Right: Gdk.BUTTON_SECONDARY,
};
const ALIASES: Record<string, PointerAction> = { click: "click", down: "press", up: "release" };
const TOKEN_PATTERN = /^\[(\/?)Mouse(Left|Middle|Right)(>?)\]$/;

const tokenAction = (isRelease: boolean, isPress: boolean): PointerAction | null => {
    if (isRelease) {
        return isPress ? null : "release";
    }

    return isPress ? "press" : "click";
};

const parsePointerInput = (input: string): PointerToken => {
    const alias = ALIASES[input];

    if (alias !== undefined) {
        return { action: alias, button: Gdk.BUTTON_PRIMARY };
    }

    const match = TOKEN_PATTERN.exec(input);
    const action = match === null ? null : tokenAction(match[1] === "/", match[3] === ">");
    const button = match?.[2] === undefined ? undefined : BUTTONS[match[2]];

    if (action === null || button === undefined) {
        throw usageError(
            new TypeError(
                `Unknown pointer input "${input}"; use [MouseLeft], [MouseRight] or [MouseMiddle], ` +
                    "with > to press and a leading / to release, or click, down and up",
            ),
        );
    }

    return { action, button };
};

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

const pressPointer = ({ click }: PointerTarget, state: UserEventState): ClickSite[] =>
    emitSitePhase(click.sites, 1, "pressed", state.modifierState);

const releasePointer = ({ widget, click }: PointerTarget, state: UserEventState, sites: ClickSite[]): void => {
    emitSitePhase(sites, 1, "released", state.modifierState);
    click.outcome?.(widget, 1, state.modifierState);
};

const isPointerPressable = (target: PointerTarget): boolean =>
    target.click.outcome !== null || target.click.sites.some((site) => site.gestures.length > 0);

const applyPrimaryInput = (widget: Gtk.Widget, state: UserEventState, action: PointerAction): void => {
    const target = pointerTargetFor(widget);
    const held = state.heldButtons.get(Gdk.BUTTON_PRIMARY);

    if (action === "click") {
        releasePointer(target, state, pressPointer(target, state));
        state.heldButtons.delete(Gdk.BUTTON_PRIMARY);
    } else if (action === "press" && held === undefined && isPointerPressable(target)) {
        state.heldButtons.set(Gdk.BUTTON_PRIMARY, pressPointer(target, state));
    } else if (action === "release" && held !== undefined) {
        releasePointer(target, state, held);
        state.heldButtons.delete(Gdk.BUTTON_PRIMARY);
    }
};

const emitButtonPhase = (
    sites: ClickSite[],
    state: UserEventState,
    phase: "pressed" | "released",
    button: number,
): ClickSite[] => emitSitePhase(sites, 1, phase, state.modifierState, button);

const applyButtonInput = (widget: Gtk.Widget, state: UserEventState, { action, button }: PointerToken): void => {
    const sites = buttonSitesFor(pointerWidgetFor(widget), button);
    const held = state.heldButtons.get(button);

    if (action === "click") {
        emitButtonPhase(emitButtonPhase(sites, state, "pressed", button), state, "released", button);
        state.heldButtons.delete(button);
    } else if (action === "press" && held === undefined && sites.length > 0) {
        state.heldButtons.set(button, emitButtonPhase(sites, state, "pressed", button));
    } else if (action === "release" && held !== undefined) {
        emitButtonPhase(held, state, "released", button);
        state.heldButtons.delete(button);
    }
};

const pointer = (state: UserEventState, widget: Gtk.Widget, input: PointerInput): Promise<void> => {
    const token = parsePointerInput(input);

    return wrapPointerEvent(widget, () => {
        if (token.button === Gdk.BUTTON_PRIMARY) {
            applyPrimaryInput(widget, state, token.action);
        } else {
            applyButtonInput(widget, state, token);
        }
    });
};

export { pointer, type PointerInput };
