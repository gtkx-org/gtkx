import * as Gtk from "@gtkx/gi/gtk";
import { hasSignalListener } from "@gtkx/runtime/internal";
import { callBooleanGetter, getWidgetMethod, hasWidgetMethod } from "../widget-getters.js";
import { queryAllControllers } from "./controller.js";
import { wrapEvent } from "./event-wrapper.js";
import { hasIndexedChildren, selectContainerChild, SELECTED_PROBE, unselectOtherChildren } from "./indexed-children.js";

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

const emitClicks = (target: Gtk.Widget, controllers: Gtk.GestureClick[], nPress: number): void => {
    for (let i = 1; i <= nPress; i++) {
        emitPress(target, controllers, i);
        emitRelease(target, controllers, i);
    }
};

const emitClickSequence = (widget: Gtk.Widget, target: Gtk.Widget, nPress: number): Promise<void> =>
    wrapEvent(widget, () => {
        emitClicks(target, queryAllControllers(target, Gtk.GestureClick), nPress);
    });

const isIndexedContainer = (widget: Gtk.Widget | null): boolean =>
    widget !== null && hasIndexedChildren(widget);

const isActivatableChild = (widget: Gtk.Widget): boolean =>
    hasWidgetMethod(widget, SELECTED_PROBE) && isIndexedContainer(widget.getParent());

const getAuthoredClickGestures = (widget: Gtk.Widget): Gtk.GestureClick[] =>
    queryAllControllers(widget, Gtk.GestureClick).filter((gesture) => hasSignalListener(gesture));

const hasAuthoredClickGesture = (widget: Gtk.Widget): boolean => getAuthoredClickGestures(widget).length > 0;

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

const isSingleClickActivating = (container: Gtk.Widget): boolean =>
    callBooleanGetter(container, "getActivateOnSingleClick") ?? true;

const isMultipleSelection = (container: Gtk.Widget): boolean => {
    const fn = getWidgetMethod(container, "getSelectionMode");

    return typeof fn === "function" && (fn as () => Gtk.SelectionMode).call(container) === Gtk.SelectionMode.MULTIPLE;
};

const isChildSelectable = (child: Gtk.Widget): boolean => callBooleanGetter(child, "getSelectable") ?? true;

const replaceContainerSelection = (container: Gtk.Widget, child: Gtk.Widget): void => {
    if (!isChildSelectable(child)) {
        return;
    }

    selectContainerChild(container, child);

    if (isMultipleSelection(container)) {
        unselectOtherChildren(container, child);
    }
};

const isActivatedByClick = (container: Gtk.Widget, nPress: number): boolean =>
    isSingleClickActivating(container) || nPress > 1;

const isSelectionReplacedByClick = (container: Gtk.Widget, nPress: number): boolean =>
    nPress > 1 || !isSingleClickActivating(container);

const applyClickOutcome = (child: Gtk.Widget, nPress: number): void => {
    const container = child.getParent();

    if (container === null) {
        return;
    }

    if (isActivatedByClick(container, nPress)) {
        child.activate();
    }

    if (isSelectionReplacedByClick(container, nPress)) {
        replaceContainerSelection(container, child);
    }
};

const emitContainerClick = (widget: Gtk.Widget, child: Gtk.Widget, nPress: number): Promise<void> =>
    wrapEvent(widget, () => {
        const container = child.getParent();

        if (container !== null) {
            emitClicks(container, getAuthoredClickGestures(container), nPress);
        }
    });

const deliverClick = async (widget: Gtk.Widget, target: Gtk.Widget, nPress: number): Promise<void> => {
    await emitClickSequence(widget, target, nPress);

    if (!isActivatableChild(target)) {
        return;
    }

    await emitContainerClick(widget, target, nPress);

    await wrapEvent(widget, () => {
        applyClickOutcome(target, nPress);
    });
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
 * Presses and releases a Gtk.Button, and otherwise activates the widget. A widget that is the
 * indexed child of a list box or flow box instead receives a click gesture, passes one on to the
 * click gestures its container carries, and is then activated, or exclusively selected when its
 * container does not activate on a single click, whether the click lands on the child itself or on
 * one of its descendants. When activation does nothing, the click goes to the widget itself if it
 * carries a click gesture of its own, and otherwise to the nearest ancestor that is a Gtk.Button, is
 * such an indexed child, or carries a click gesture. A widget with the label role is never activated
 * and never consumes the click itself.
 */
const click = async (widget: Gtk.Widget): Promise<void> => {
    if (widget instanceof Gtk.Button) {
        await emitClickSequence(widget, widget, 1);

        return;
    }

    if (isActivatableChild(widget)) {
        await deliverClick(widget, widget, 1);

        return;
    }

    if (await tryActivate(widget)) {
        return;
    }

    const target = isSelfClickTarget(widget) ? widget : findClickableAncestor(widget);

    if (target) {
        await deliverClick(widget, target, 1);
    }
};

/**
 * Emits a two-press click gesture at the widget's center on the click gestures it already carries.
 * A list box row or flow box child is then activated and its container's selection replaced with
 * it, as GTK's double-click path does whether or not the container activates on a single click.
 */
const dblClick = (widget: Gtk.Widget): Promise<void> => deliverClick(widget, widget, 2);
/**
 * Emits a three-press click gesture at the widget's center on the click gestures it already
 * carries, applying the same outcome to a list box row or flow box child as a double click.
 */
const tripleClick = (widget: Gtk.Widget): Promise<void> => deliverClick(widget, widget, 3);

export { emitPress, emitRelease, click, dblClick, tripleClick };
