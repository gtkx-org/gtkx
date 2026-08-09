import * as Gtk from "@gtkx/gi/gtk";
import { getOrCreateControllers, queryController } from "./controller.js";
import { wrapEvent } from "./event-wrapper.js";

const getPressPoint = (widget: Gtk.Widget): { x: number; y: number } => {
    const width = widget.getWidth();
    const height = widget.getHeight();

    if (width > 0 && height > 0) {
        return { x: width / 2, y: height / 2 };
    }

    return { x: 0, y: 0 };
};

const emitGesture = (widget: Gtk.Widget, controllers: Gtk.GestureClick[], nPress: number, signal: string): void => {
    const { x, y } = getPressPoint(widget);

    for (const controller of controllers) {
        controller.emit(signal, nPress, x, y);
    }
};

const emitPress = (widget: Gtk.Widget, controllers: Gtk.GestureClick[], nPress: number): void => {
    emitGesture(widget, controllers, nPress, "pressed");
};

const emitRelease = (widget: Gtk.Widget, controllers: Gtk.GestureClick[], nPress: number): void => {
    emitGesture(widget, controllers, nPress, "released");
};

const emitClickSequence = (widget: Gtk.Widget, target: Gtk.Widget, nPress: number): Promise<void> =>
    wrapEvent(widget, () => {
        const controllers = getOrCreateControllers(target, Gtk.GestureClick);

        for (let i = 1; i <= nPress; i++) {
            emitPress(target, controllers, i);
            emitRelease(target, controllers, i);
        }
    });

const findClickableAncestor = (widget: Gtk.Widget): Gtk.Widget | null => {
    let current = widget.getParent();

    while (current) {
        if (current instanceof Gtk.Button || queryController(current, Gtk.GestureClick) !== null) {
            return current;
        }

        current = current.getParent();
    }

    return null;
};

/* eslint-disable-next-line unicorn/consistent-boolean-name -- the boolean reports whether activation succeeded */
const tryActivate = async (widget: Gtk.Widget): Promise<boolean> => {
    if (widget.getAccessibleRole() === Gtk.AccessibleRole.LABEL) {
        return false;
    }

    let isActivated = false;

    await wrapEvent(widget, () => {
        isActivated = widget.activate();
    });

    return isActivated;
};

/**
 * Presses and releases a Gtk.Button, and otherwise activates the widget, falling back to a click
 * gesture on the nearest Gtk.Button or click-gesture ancestor when activation does nothing. A
 * widget with the label role is never activated.
 */
const click = async (widget: Gtk.Widget): Promise<void> => {
    if (widget instanceof Gtk.Button) {
        await emitClickSequence(widget, widget, 1);

        return;
    }

    if (await tryActivate(widget)) {
        return;
    }

    const target = findClickableAncestor(widget);

    if (target) {
        await emitClickSequence(widget, target, 1);
    }
};

/** Emits a two-press click gesture at the widget's center, adding a Gtk.GestureClick when it has none. */
const dblClick = (widget: Gtk.Widget): Promise<void> => emitClickSequence(widget, widget, 2);
/** Emits a three-press click gesture at the widget's center, adding a Gtk.GestureClick when it has none. */
const tripleClick = (widget: Gtk.Widget): Promise<void> => emitClickSequence(widget, widget, 3);

export { emitPress, emitRelease, click, dblClick, tripleClick };
