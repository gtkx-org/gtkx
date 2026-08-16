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

/**
 * Activates a widget that neither claims the click nor carries a click gesture of its own, and
 * otherwise delivers a press and release. The press travels outwards from the clicked widget
 * through every widget carrying a click gesture with a pressed or released handler, the way GTK
 * hands the same press to each of them, and stops at the first Gtk.Button or indexed child of a
 * list box or flow box, which claims it. A gesture GTK attached itself takes the press only when no
 * widget below it handles one, and stops it there, so an expander or a notebook tab nested in a row
 * opens instead of activating the row. Coordinates are the clicked widget's position in each
 * carrier, so a gesture the container of an indexed child carries reads the child's position rather
 * than the container's center. An indexed child that the press reaches is then activated, or
 * exclusively selected when its container does not activate on a single click. A widget with the
 * label role is never activated, but does consume the click when it carries a gesture of its own.
 *
 * The press also stops at a widget whose click GTK4 implements in C on a gesture it attached
 * itself, reading a GdkEvent that off-screen synthesis cannot produce. Gestures that widget carries
 * of its own still take the press and release, the way GTK hands them the press before its own
 * gesture claims it, and the same outcome is then applied through the public action GTK's own
 * handler invokes: a list, grid, or column-view row is focused and selected, and activated as well
 * on a second press or when its view activates on a single click; an expandable tree expander
 * toggles its expansion, once per press, and only when it is the widget clicked, so a click on its
 * child falls through to the enclosing row; a notebook tab, clicked directly or through its label,
 * focuses its notebook and switches to its page; a column header sorts by its column. Sorting goes
 * through Gtk.ColumnView.sortByColumn, so the primary sort column and order match what a pointer
 * produces while previously sorted columns are dropped rather than kept as secondary keys. A
 * column-view cell and the row that carries the column headers stand in the way of the click rather
 * than taking it, so a click on either reaches the row or the view behind it.
 */
const click = async (widget: Gtk.Widget): Promise<void> => {
    if (!isSelfClickTarget(widget) && (await tryActivate(widget))) {
        return;
    }

    await deliverClick(widget, 1);
};

/**
 * Delivers a two-press click gesture the way {@link click} delivers a single press, without trying
 * activation first. A list box row or flow box child the presses reach, clicked directly or through
 * a descendant, is activated and exclusively selected, as GTK's double-click path does whether or
 * not the container activates on a single click. A widget whose click GTK4 implements itself
 * receives that outcome once per press, so a list, grid, or column-view row is selected and then
 * activated by the second press, a tree expander ends back where it started, a notebook tab stays on
 * the page the first press opened, and a column header sorts and then inverts its order.
 */
const dblClick = (widget: Gtk.Widget): Promise<void> => deliverClick(widget, 2);
/**
 * Delivers a three-press click gesture the same way a double click is delivered, applying the same
 * outcome to a list box row or flow box child the presses reach, and applying the outcome GTK4
 * implements itself once per press to a row, tree expander, notebook tab, or column header.
 */
const tripleClick = (widget: Gtk.Widget): Promise<void> => deliverClick(widget, 3);

export { clickGestures, emitClickPhase, getAuthoredClickGestures, click, dblClick, tripleClick };
