import * as Gtk from "@gtkx/gi/gtk";
import { getOrCreateControllers, isSynthesizedController, queryAllControllers } from "./controller.js";
import { wrapEvent } from "./event-wrapper.js";
import { hasIndexedChildren, hasWidgetMethod, selectContainerChild, SELECTED_PROBE } from "./indexed-children.js";

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

const isIndexedContainer = (widget: Gtk.Widget | null): boolean =>
    widget !== null && hasIndexedChildren(widget);

const isActivatableChild = (widget: Gtk.Widget): boolean =>
    hasWidgetMethod(widget, SELECTED_PROBE) && isIndexedContainer(widget.getParent());

const hasAuthoredClickGesture = (widget: Gtk.Widget): boolean =>
    queryAllControllers(widget, Gtk.GestureClick).some((gesture) => !isSynthesizedController(gesture));

const isClickTarget = (widget: Gtk.Widget): boolean =>
    isActivatableChild(widget) || widget instanceof Gtk.Button || hasAuthoredClickGesture(widget);

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

const isSelfClickTarget = (widget: Gtk.Widget): boolean =>
    widget.getAccessibleRole() !== Gtk.AccessibleRole.LABEL && isClickTarget(widget);

const isSingleClickActivating = (container: Gtk.Widget): boolean => {
    const fn: unknown = Reflect.get(container, "getActivateOnSingleClick");

    return typeof fn !== "function" || (fn as () => boolean).call(container);
};

const activateContainerChild = (child: Gtk.Widget): void => {
    const container = child.getParent();

    if (container === null || isSingleClickActivating(container)) {
        child.activate();

        return;
    }

    selectContainerChild(container, child);
};

const deliverClick = (widget: Gtk.Widget, target: Gtk.Widget): Promise<void> => {
    if (isActivatableChild(target)) {
        return wrapEvent(widget, () => {
            activateContainerChild(target);
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
 * Presses and releases a Gtk.Button, and otherwise activates the widget. When activation does
 * nothing, the click goes to the widget itself if it carries a click gesture of its own, and
 * otherwise to the nearest ancestor that does. An ancestor that is the indexed child of a list box
 * or flow box is activated, or merely selected when its container does not activate on a single
 * click. A widget with the label role is never activated and never consumes the click itself.
 */
const click = async (widget: Gtk.Widget): Promise<void> => {
    if (widget instanceof Gtk.Button) {
        await emitClickSequence(widget, widget, 1);

        return;
    }

    if (await tryActivate(widget)) {
        return;
    }

    const target = isSelfClickTarget(widget) ? widget : findClickableAncestor(widget);

    if (target) {
        await deliverClick(widget, target);
    }
};

/** Emits a two-press click gesture at the widget's center, adding a Gtk.GestureClick when it has none. */
const dblClick = (widget: Gtk.Widget): Promise<void> => emitClickSequence(widget, widget, 2);
/** Emits a three-press click gesture at the widget's center, adding a Gtk.GestureClick when it has none. */
const tripleClick = (widget: Gtk.Widget): Promise<void> => emitClickSequence(widget, widget, 3);

export { emitPress, emitRelease, click, dblClick, tripleClick };
