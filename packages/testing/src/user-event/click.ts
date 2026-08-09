import * as Gtk from "@gtkx/gi/gtk";
import { hasSignalListener } from "@gtkx/runtime/internal";
import { callBooleanGetter, getCallableMethod, hasWidgetMethod } from "../widget-getters.js";
import { queryAllControllers } from "./controller.js";
import { wrapEvent } from "./event-wrapper.js";
import { hasIndexedChildren, selectContainerChild, SELECTED_PROBE, unselectOtherChildren } from "./indexed-children.js";

type PressPoint = { x: number; y: number };

const CLICK_SIGNALS = ["pressed", "released"];

const getCenterPoint = (widget: Gtk.Widget): PressPoint => {
    const width = widget.getWidth();
    const height = widget.getHeight();

    if (width > 0 && height > 0) {
        return { x: width / 2, y: height / 2 };
    }

    return { x: 0, y: 0 };
};

const getClickPoint = (clicked: Gtk.Widget, carrier: Gtk.Widget): PressPoint => {
    if (clicked === carrier) {
        return getCenterPoint(clicked);
    }

    const [isComputed, bounds] = clicked.computeBounds(carrier);

    if (!isComputed) {
        return getCenterPoint(carrier);
    }

    return { x: bounds.getX() + bounds.getWidth() / 2, y: bounds.getY() + bounds.getHeight() / 2 };
};

const emitGesture = (point: PressPoint, controllers: Gtk.GestureClick[], nPress: number, signal: string): void => {
    for (const controller of controllers) {
        controller.emit(signal, nPress, point.x, point.y);
    }
};

const emitPress = (widget: Gtk.Widget, controllers: Gtk.GestureClick[], nPress: number): void => {
    emitGesture(getCenterPoint(widget), controllers, nPress, "pressed");
};

const emitRelease = (widget: Gtk.Widget, controllers: Gtk.GestureClick[], nPress: number): void => {
    emitGesture(getCenterPoint(widget), controllers, nPress, "released");
};

const emitClickSequence = (
    clicked: Gtk.Widget,
    controllers: Gtk.GestureClick[],
    nPress: number,
    carrier: Gtk.Widget,
): void => {
    const point = getClickPoint(clicked, carrier);

    for (let i = 1; i <= nPress; i++) {
        emitGesture(point, controllers, i, "pressed");
        emitGesture(point, controllers, i, "released");
    }
};

const isIndexedContainer = (widget: Gtk.Widget | null): boolean =>
    widget !== null && hasIndexedChildren(widget);

const isActivatableChild = (widget: Gtk.Widget): boolean =>
    hasWidgetMethod(widget, SELECTED_PROBE) && isIndexedContainer(widget.getParent());

const getAuthoredClickGestures = (widget: Gtk.Widget): Gtk.GestureClick[] =>
    queryAllControllers(widget, Gtk.GestureClick).filter((gesture) => hasSignalListener(gesture, CLICK_SIGNALS));

const hasAuthoredClickGesture = (widget: Gtk.Widget): boolean => getAuthoredClickGestures(widget).length > 0;
const hasAnyClickGesture = (widget: Gtk.Widget): boolean => queryAllControllers(widget, Gtk.GestureClick).length > 0;

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

const findGestureCarrier = (widget: Gtk.Widget): Gtk.Widget | null => {
    let current: Gtk.Widget | null =
        widget.getAccessibleRole() === Gtk.AccessibleRole.LABEL ? widget.getParent() : widget;

    while (current) {
        if (hasAnyClickGesture(current)) {
            return current;
        }

        current = current.getParent();
    }

    return null;
};

const findActivatableTarget = (widget: Gtk.Widget): Gtk.Widget | null => {
    let current: Gtk.Widget | null = widget;

    while (current) {
        if (isActivatableChild(current)) {
            return current;
        }

        current = current.getParent();
    }

    return null;
};

const isSingleClickActivating = (container: Gtk.Widget): boolean =>
    callBooleanGetter(container, "getActivateOnSingleClick") ?? true;

const isMultipleSelection = (container: Gtk.Widget): boolean =>
    getCallableMethod<[], Gtk.SelectionMode>(container, "getSelectionMode")?.() === Gtk.SelectionMode.MULTIPLE;

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

const applyClickOutcome = (container: Gtk.Widget, child: Gtk.Widget, nPress: number): void => {
    if (isActivatedByClick(container, nPress)) {
        child.activate();
    }

    if (isSelectionReplacedByClick(container, nPress)) {
        replaceContainerSelection(container, child);
    }
};

const deliverClick = (widget: Gtk.Widget, target: Gtk.Widget, nPress: number): Promise<void> =>
    wrapEvent(widget, () => {
        emitClickSequence(widget, queryAllControllers(target, Gtk.GestureClick), nPress, target);
        const container = isActivatableChild(target) ? target.getParent() : null;

        if (container !== null) {
            emitClickSequence(widget, getAuthoredClickGestures(container), nPress, container);
            applyClickOutcome(container, target, nPress);
        }
    });

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

const findClickTarget = (widget: Gtk.Widget): Gtk.Widget | null =>
    isSelfClickTarget(widget) ? widget : (findClickableAncestor(widget) ?? findGestureCarrier(widget));

/**
 * Presses and releases a Gtk.Button, and otherwise activates the widget. A widget that is the
 * indexed child of a list box or flow box instead receives a click gesture, passes one on at the
 * clicked widget's position to the click gestures its container carries, and is then activated, or
 * exclusively selected when its container does not activate on a single click, whether the click
 * lands on the child itself or on one of its descendants. When activation does nothing, the click
 * goes to the widget itself if it carries a click gesture with a pressed or released handler,
 * otherwise to the nearest ancestor that is a Gtk.Button, is such an indexed child, or carries such
 * a gesture, and as a last resort to the nearest widget carrying any click gesture, including the
 * ones GTK attaches internally. A widget with the label role is never activated and never consumes
 * the click itself.
 */
const click = async (widget: Gtk.Widget): Promise<void> => {
    if (widget instanceof Gtk.Button || isActivatableChild(widget)) {
        await deliverClick(widget, widget, 1);

        return;
    }

    if (await tryActivate(widget)) {
        return;
    }

    const target = findClickTarget(widget);

    if (target) {
        await deliverClick(widget, target, 1);
    }
};

/**
 * Emits a two-press click gesture at the clicked widget's position on the click gestures it already
 * carries. A list box row or flow box child, clicked directly or through a descendant, also passes
 * the presses on to its container's click gestures and is then activated and exclusively selected,
 * as GTK's double-click path does whether or not the container activates on a single click.
 */
const dblClick = (widget: Gtk.Widget): Promise<void> =>
    deliverClick(widget, findActivatableTarget(widget) ?? widget, 2);

/**
 * Emits a three-press click gesture the same way a double click is delivered, applying the same
 * outcome to a list box row or flow box child clicked directly or through a descendant.
 */
const tripleClick = (widget: Gtk.Widget): Promise<void> =>
    deliverClick(widget, findActivatableTarget(widget) ?? widget, 3);

export { emitPress, emitRelease, click, dblClick, tripleClick };
