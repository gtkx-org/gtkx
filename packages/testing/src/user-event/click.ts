import * as Gtk from "@gtkx/gi/gtk";
import { getOrCreateControllers, queryController } from "./controller.js";
import { wrapEvent } from "./event-wrapper.js";

const CHILD_AT_INDEX_GETTERS = ["getRowAtIndex", "getChildAtIndex"];
const SELECTED_PROBE = "isSelected";

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

const hasWidgetMethod = (widget: Gtk.Widget, name: string): boolean =>
    typeof Reflect.get(widget, name) === "function";

const isIndexedContainer = (widget: Gtk.Widget | null): boolean =>
    widget !== null && CHILD_AT_INDEX_GETTERS.some((getter) => hasWidgetMethod(widget, getter));

const isActivatableChild = (widget: Gtk.Widget): boolean =>
    hasWidgetMethod(widget, SELECTED_PROBE) && isIndexedContainer(widget.getParent());

const isClickTarget = (widget: Gtk.Widget): boolean =>
    isActivatableChild(widget) ||
    widget instanceof Gtk.Button ||
    queryController(widget, Gtk.GestureClick) !== null;

const findClickableAncestor = (widget: Gtk.Widget): Gtk.Widget | null => {
    let current = widget.getParent();

    while (current) {
        if (isClickTarget(current)) {
            return current;
        }

        current = current.getParent();
    }

    return null;
};

const deliverClick = (widget: Gtk.Widget, target: Gtk.Widget): Promise<void> => {
    if (isActivatableChild(target)) {
        return wrapEvent(widget, () => {
            target.activate();
        });
    }

    return emitClickSequence(widget, target, 1);
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
        await deliverClick(widget, target);
    }
};

/** Emits a two-press click gesture at the widget's center, adding a Gtk.GestureClick when it has none. */
const dblClick = (widget: Gtk.Widget): Promise<void> => emitClickSequence(widget, widget, 2);
/** Emits a three-press click gesture at the widget's center, adding a Gtk.GestureClick when it has none. */
const tripleClick = (widget: Gtk.Widget): Promise<void> => emitClickSequence(widget, widget, 3);

export { emitPress, emitRelease, click, dblClick, tripleClick };
