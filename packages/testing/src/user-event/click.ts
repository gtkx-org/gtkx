import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { hasSignalListener } from "@gtkx/runtime/internal";
import { callBooleanGetter, getCallableMethod, hasWidgetMethod } from "../widget-getters.js";
import { queryAllControllers } from "./controller.js";
import { wrapEvent } from "./event-wrapper.js";
import { hasIndexedChildren, selectContainerChild, SELECTED_PROBE, unselectOtherChildren } from "./indexed-children.js";
import { isClickTransparent, type NativeClick, nativeClickFor } from "./native-click.js";

type PressPoint = { x: number; y: number };
type ClickPhase = "pressed" | "released";
type ClickSite = { gestures: Gtk.GestureClick[]; point: PressPoint };
type ClickScope = { isClicked: boolean; isInternalAllowed: boolean };

type ClickTarget = {
    widget: Gtk.Widget;
    container: Gtk.Widget | null;
    gestures: Gtk.GestureClick[];
    isClaiming: boolean;
    native: NativeClick | null;
};

const CLICK_SIGNALS = ["pressed", "released"];
const PRIMARY_BUTTONS: Set<number> = new Set([0, Gdk.BUTTON_PRIMARY]);

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

const emitGesture = (
    point: PressPoint,
    controllers: Gtk.GestureClick[],
    nPress: number,
    signal: ClickPhase,
): void => {
    for (const controller of controllers) {
        controller.emit(signal, nPress, point.x, point.y);
    }
};

const emitClickPhase = (
    widget: Gtk.Widget,
    controllers: Gtk.GestureClick[],
    nPress: number,
    phase: ClickPhase,
): void => {
    emitGesture(getCenterPoint(widget), controllers, nPress, phase);
};

const emitSitePhase = (sites: ClickSite[], nPress: number, phase: ClickPhase): void => {
    for (const site of sites) {
        emitGesture(site.point, site.gestures, nPress, phase);
    }
};

const emitClickSequence = (sites: ClickSite[], nPress: number): void => {
    for (let i = 1; i <= nPress; i++) {
        emitSitePhase(sites, i, "pressed");
        emitSitePhase(sites, i, "released");
    }
};

const containerFor = (widget: Gtk.Widget): Gtk.Widget | null => {
    const parent = widget.getParent();

    return parent !== null && hasWidgetMethod(widget, SELECTED_PROBE) && hasIndexedChildren(parent) ? parent : null;
};

const hasClickHandlers = (gesture: Gtk.GestureClick): boolean => hasSignalListener(gesture, CLICK_SIGNALS);
const isInternalGesture = (gesture: Gtk.GestureClick): boolean => !hasSignalListener(gesture);
const isPrimaryGesture = (gesture: Gtk.GestureClick): boolean => PRIMARY_BUTTONS.has(gesture.getButton());

const clickGestures = (widget: Gtk.Widget): Gtk.GestureClick[] =>
    queryAllControllers(widget, Gtk.GestureClick).filter((gesture) => isPrimaryGesture(gesture));

const getAuthoredClickGestures = (widget: Gtk.Widget): Gtk.GestureClick[] =>
    clickGestures(widget).filter((gesture) => hasClickHandlers(gesture));

const isClaimingTarget = (widget: Gtk.Widget): boolean =>
    widget instanceof Gtk.Button || containerFor(widget) !== null;

const gestureTargetFor = (widget: Gtk.Widget, isInternalAllowed: boolean): ClickTarget | null => {
    const gestures = clickGestures(widget);

    if (isClaimingTarget(widget)) {
        return { widget, container: containerFor(widget), gestures, isClaiming: true, native: null };
    }

    const authored = gestures.filter((gesture) => hasClickHandlers(gesture));

    if (authored.length > 0) {
        return { widget, container: null, gestures: authored, isClaiming: false, native: null };
    }

    if (isInternalAllowed && gestures.some((gesture) => isInternalGesture(gesture))) {
        return { widget, container: null, gestures, isClaiming: true, native: null };
    }

    return null;
};

const clickTargetFor = (widget: Gtk.Widget, scope: ClickScope): ClickTarget | null => {
    if (isClickTransparent(widget)) {
        return null;
    }

    const native = nativeClickFor(widget, scope.isClicked);

    if (native !== null) {
        return { widget, container: null, gestures: getAuthoredClickGestures(widget), isClaiming: true, native };
    }

    return gestureTargetFor(widget, scope.isInternalAllowed);
};

const isSelfClickTarget = (widget: Gtk.Widget): boolean =>
    isClickTransparent(widget) || clickTargetFor(widget, { isClicked: true, isInternalAllowed: false }) !== null;

const nextClickWidget = (current: Gtk.Widget, target: ClickTarget | null): Gtk.Widget | null =>
    target?.isClaiming === true ? null : current.getParent();

const collectClickTargets = (widget: Gtk.Widget): ClickTarget[] => {
    const targets: ClickTarget[] = [];
    let current: Gtk.Widget | null = widget;

    while (current !== null) {
        const isClicked = current === widget;
        const scope = { isClicked, isInternalAllowed: !isClicked && targets.length === 0 };
        const target = clickTargetFor(current, scope);
        const next = nextClickWidget(current, target);

        if (target !== null) {
            targets.push(target);
        }

        current = next;
    }

    return targets;
};

const targetSites = (clicked: Gtk.Widget, target: ClickTarget): ClickSite[] => {
    const { container } = target;
    const site = { gestures: target.gestures, point: getClickPoint(clicked, target.widget) };

    if (container === null) {
        return [site];
    }

    return [site, { gestures: getAuthoredClickGestures(container), point: getClickPoint(clicked, container) }];
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

const applyContainerOutcome = (target: ClickTarget, nPress: number): void => {
    const { container, widget } = target;

    if (container === null || widget.getParent() !== container) {
        return;
    }

    if (isActivatedByClick(container, nPress)) {
        widget.activate();
    }

    if (isSelectionReplacedByClick(container, nPress)) {
        replaceContainerSelection(container, widget);
    }
};

const applyClickOutcome = (target: ClickTarget, nPress: number): void => {
    if (target.native === null) {
        applyContainerOutcome(target, nPress);

        return;
    }

    target.native(target.widget, nPress);
};

const applyClickOutcomes = (targets: ClickTarget[], nPress: number): void => {
    for (const target of targets) {
        applyClickOutcome(target, nPress);
    }
};

const deliverClick = (widget: Gtk.Widget, nPress: number): Promise<void> =>
    wrapEvent(widget, () => {
        const targets = collectClickTargets(widget);
        const sites = targets.flatMap((target) => targetSites(widget, target));
        emitClickSequence(sites, nPress);
        applyClickOutcomes(targets, nPress);
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

/** Activates or presses and releases a widget. */
const click = async (widget: Gtk.Widget): Promise<void> => {
    if (!isSelfClickTarget(widget) && (await tryActivate(widget))) {
        return;
    }

    await deliverClick(widget, 1);
};

/** Delivers a double-click gesture. */
const dblClick = (widget: Gtk.Widget): Promise<void> => deliverClick(widget, 2);
/** Delivers a triple-click gesture. */
const tripleClick = (widget: Gtk.Widget): Promise<void> => deliverClick(widget, 3);

export { clickGestures, emitClickPhase, getAuthoredClickGestures, click, dblClick, tripleClick };
