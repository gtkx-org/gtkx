import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { hasSignalListener } from "@gtkx/runtime/internal";
import { callBooleanGetter, getCallableMethod, hasWidgetMethod } from "../widget-getters.js";
import { queryAllControllers } from "./controller.js";
import { wrapPointerEvent } from "./event-wrapper.js";
import { hasIndexedChildren, selectContainerChild, SELECTED_PROBE, unselectOtherChildren } from "./indexed-children.js";
import { isClickTransparent, type NativeClick, nativeClickFor } from "./native-click.js";
import type { UserEventState } from "./state.js";

type PressPoint = { x: number; y: number };
type ClickPhase = "pressed" | "released";
type ClickSite = { gestures: Gtk.GestureClick[]; point: PressPoint };
type ClickScope = { isClicked: boolean; isInternalAllowed: boolean };
type DirectClick = { sites: ClickSite[]; outcome: NativeClick | null };
type CurrentEventPatch = {
    getCurrentButton?: Gtk.GestureClick["getCurrentButton"] | undefined;
    getCurrentEventState?: Gtk.GestureClick["getCurrentEventState"] | undefined;
    setState?: Gtk.GestureClick["setState"] | undefined;
};

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

const emitWithCurrentEvent = (
    controller: Gtk.GestureClick,
    button: number,
    modifiers: Gdk.ModifierType,
    emit: () => void,
): boolean => {
    const instance: CurrentEventPatch = controller;
    const hasOwnButton = Object.hasOwn(instance, "getCurrentButton");
    const hasOwnState = Object.hasOwn(instance, "getCurrentEventState");
    const hasOwnSetState = Object.hasOwn(instance, "setState");
    const previousButton = instance.getCurrentButton;
    const previousState = instance.getCurrentEventState;
    const previousSetState = instance.setState;
    let isClaimed = false;
    instance.getCurrentButton = () => button;
    instance.getCurrentEventState = () => modifiers;
    instance.setState = (state) => {
        isClaimed = state === Gtk.EventSequenceState.CLAIMED;
        return true;
    };

    try {
        emit();
    } finally {
        if (hasOwnButton) {
            instance.getCurrentButton = previousButton;
        } else {
            delete instance.getCurrentButton;
        }

        if (hasOwnState) {
            instance.getCurrentEventState = previousState;
        } else {
            delete instance.getCurrentEventState;
        }

        if (hasOwnSetState) {
            instance.setState = previousSetState;
        } else {
            delete instance.setState;
        }
    }

    return isClaimed;
};

const emitGesture = (
    point: PressPoint,
    controllers: Gtk.GestureClick[],
    nPress: number,
    signal: ClickPhase,
    button: number,
    modifiers: Gdk.ModifierType,
): boolean => {
    let isClaimed = false;

    for (const controller of controllers) {
        const hasClaimed = emitWithCurrentEvent(controller, button, modifiers, () => {
            controller.emit(signal, nPress, point.x, point.y);
        });
        isClaimed ||= hasClaimed;
    }

    return isClaimed;
};

const emitSitePhase = (
    sites: ClickSite[],
    nPress: number,
    phase: ClickPhase,
    modifiers: Gdk.ModifierType,
    button: number = Gdk.BUTTON_PRIMARY,
): ClickSite[] => {
    const reached: ClickSite[] = [];

    for (const site of sites) {
        reached.push(site);

        if (emitGesture(site.point, site.gestures, nPress, phase, button, modifiers)) {
            break;
        }
    }

    return reached;
};

const emitClickSequence = (sites: ClickSite[], nPress: number, modifiers: Gdk.ModifierType): void => {
    for (let i = 1; i <= nPress; i++) {
        const reached = emitSitePhase(sites, i, "pressed", modifiers);
        emitSitePhase(reached, i, "released", modifiers);
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

const gestureTargetFor = (widget: Gtk.Widget, isInternalAllowed: boolean): ClickTarget | null => {
    const gestures = clickGestures(widget);

    if (widget instanceof Gtk.Button) {
        return { widget, container: null, gestures, isClaiming: true, native: null };
    }

    if (widget instanceof Gtk.WindowHandle) {
        return { widget, container: null, gestures: getAuthoredClickGestures(widget), isClaiming: true, native: null };
    }

    const container = containerFor(widget);

    if (container !== null) {
        return {
            widget,
            container,
            gestures: gestures.filter((gesture) => hasClickHandlers(gesture)),
            isClaiming: true,
            native: null,
        };
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
        Gtk.Widget.prototype.activate.call(widget);
    }

    if (isSelectionReplacedByClick(container, nPress)) {
        replaceContainerSelection(container, widget);
    }
};

const applyClickOutcome = (target: ClickTarget, nPress: number, modifiers: Gdk.ModifierType): void => {
    if (target.native === null) {
        applyContainerOutcome(target, nPress);

        return;
    }

    target.native(target.widget, nPress, modifiers);
};

const applyContainerClick: NativeClick = (widget, nPress) => {
    const container = containerFor(widget);

    if (container !== null) {
        applyContainerOutcome({ widget, container, gestures: [], isClaiming: true, native: null }, nPress);
    }
};

const directClickFor = (widget: Gtk.Widget): DirectClick => {
    const native = nativeClickFor(widget, true);
    const container = native === null ? containerFor(widget) : null;
    const gestures = native !== null || container !== null ? getAuthoredClickGestures(widget) : clickGestures(widget);
    const target: ClickTarget = { widget, container, gestures, isClaiming: true, native };

    return { sites: targetSites(widget, target), outcome: native ?? (container === null ? null : applyContainerClick) };
};

const listensForButton = (gesture: Gtk.GestureClick, button: number): boolean => {
    const listened = gesture.getButton();

    return listened === 0 || listened === button;
};

/**
 * The press sites a non-primary button reaches: the authored click gestures listening for that button on the widget
 * and its ancestors, as GTK propagates the press up the tree. Widgets react to these buttons only through gestures.
 */
const buttonSitesFor = (widget: Gtk.Widget, button: number): ClickSite[] => {
    const sites: ClickSite[] = [];

    for (let current: Gtk.Widget | null = widget; current !== null; current = current.getParent()) {
        const gestures = queryAllControllers(current, Gtk.GestureClick).filter(
            (gesture) => listensForButton(gesture, button) && hasClickHandlers(gesture),
        );

        if (gestures.length > 0) {
            sites.push({ gestures, point: getClickPoint(widget, current) });
        }
    }

    return sites;
};

const applyClickOutcomes = (targets: ClickTarget[], nPress: number, modifiers: Gdk.ModifierType): void => {
    for (const target of targets) {
        applyClickOutcome(target, nPress, modifiers);
    }
};

/**
 * Whether a click target is known to handle the click: app code listens to its gestures, GTKX applies the outcome a
 * real click has, or it is a button. GTK's other gestures read the real pointer event, so a click that reaches only
 * them may do nothing.
 */
const isHandlingTarget = (target: ClickTarget): boolean =>
    target.native !== null ||
    target.container !== null ||
    target.widget instanceof Gtk.Button ||
    target.gestures.some((gesture) => hasClickHandlers(gesture));

const deliverClick = async (state: UserEventState, widget: Gtk.Widget, nPress: number): Promise<boolean> => {
    let isHandled = false;

    await wrapPointerEvent(widget, () => {
        const targets = collectClickTargets(widget);
        const sites = targets.flatMap((target) => targetSites(widget, target));
        emitClickSequence(sites, nPress, state.modifierState);
        applyClickOutcomes(targets, nPress, state.modifierState);
        isHandled = targets.some((target) => isHandlingTarget(target));
    });

    return isHandled;
};

const tryActivate = async (widget: Gtk.Widget): Promise<boolean> => {
    if (widget.getAccessibleRole() === Gtk.AccessibleRole.LABEL) {
        return false;
    }

    let isActivated = false;

    await wrapPointerEvent(widget, () => {
        isActivated = Gtk.Widget.prototype.activate.call(widget);
    });

    return isActivated;
};

/** Activates or presses and releases a widget, and returns whether anything is known to have handled the click. */
const click = async (state: UserEventState, widget: Gtk.Widget): Promise<boolean> => {
    if (!isSelfClickTarget(widget) && (await tryActivate(widget))) {
        return true;
    }

    return deliverClick(state, widget, 1);
};

/** Delivers a double-click gesture. */
const dblClick = (state: UserEventState, widget: Gtk.Widget): Promise<boolean> => deliverClick(state, widget, 2);
/** Delivers a triple-click gesture. */
const tripleClick = (state: UserEventState, widget: Gtk.Widget): Promise<boolean> => deliverClick(state, widget, 3);

export { buttonSitesFor, directClickFor, emitSitePhase, click, dblClick, tripleClick };
export type { ClickSite, DirectClick };
