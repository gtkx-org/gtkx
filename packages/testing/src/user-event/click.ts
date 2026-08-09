import * as Gtk from "@gtkx/gi/gtk";
import { callBooleanGetter, getWidgetMethod, hasWidgetMethod } from "../widget-getters.js";
import { getOrCreateControllers, isSynthesizedController, queryAllControllers } from "./controller.js";
import { wrapEvent } from "./event-wrapper.js";
import { hasIndexedChildren, selectContainerChild, SELECTED_PROBE, unselectAllChildren } from "./indexed-children.js";

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

    if (isMultipleSelection(container)) {
        unselectAllChildren(container);
    }

    selectContainerChild(container, child);
};

const activateContainerChild = (child: Gtk.Widget): void => {
    const container = child.getParent();

    if (container === null || isSingleClickActivating(container)) {
        child.activate();

        return;
    }

    replaceContainerSelection(container, child);
};

const deliverClick = async (widget: Gtk.Widget, target: Gtk.Widget): Promise<void> => {
    await emitClickSequence(widget, target, 1);

    if (isActivatableChild(target)) {
        await wrapEvent(widget, () => {
            activateContainerChild(target);
        });
    }
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
 * indexed child of a list box or flow box instead receives a click gesture and is then activated,
 * or exclusively selected when its container does not activate on a single click, whether the click
 * lands on the child itself or on one of its descendants. When activation does nothing, the click
 * goes to the widget itself if it carries a click gesture of its own, and otherwise to the nearest
 * ancestor that does. A widget with the label role is never activated and never consumes the click
 * itself.
 */
const click = async (widget: Gtk.Widget): Promise<void> => {
    if (widget instanceof Gtk.Button) {
        await emitClickSequence(widget, widget, 1);

        return;
    }

    if (isActivatableChild(widget)) {
        await deliverClick(widget, widget);

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

/**
 * Emits a two-press click gesture at the widget's center, adding a Gtk.GestureClick when it has
 * none. A list box row or flow box child whose container does not activate on a single click is
 * then selected and activated, as GTK's double-click path does.
 */
const dblClick = async (widget: Gtk.Widget): Promise<void> => {
    await emitClickSequence(widget, widget, 2);
    const container = widget.getParent();

    if (container === null || !isActivatableChild(widget) || isSingleClickActivating(container)) {
        return;
    }

    await wrapEvent(widget, () => {
        replaceContainerSelection(container, widget);
        widget.activate();
    });
};

/** Emits a three-press click gesture at the widget's center, adding a Gtk.GestureClick when it has none. */
const tripleClick = (widget: Gtk.Widget): Promise<void> => emitClickSequence(widget, widget, 3);

export { emitPress, emitRelease, click, dblClick, tripleClick };
