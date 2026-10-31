import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { runInAct, runWithActEnvironment } from "../act.js";
import { getConfig } from "../config.js";
import { formatRole } from "../role-helpers.js";
import { delay, now } from "../timers.js";
import { ancestors } from "../traversal.js";
import { getWidgetAccessibleName } from "../widget-accessible-properties.js";
import { getTypeTag, isDefaultWidgetName } from "../widget-getters.js";
import { isWindowAllocated, isWindowBlockedByModal } from "../window-state.js";
import { usageError } from "../usage-error.js";

const NOT_SENSITIVE = "it is not sensitive (the widget or one of its ancestors is disabled)";
const NOT_ROOTED = "it is not inside a toplevel (it was removed from the widget tree, or was never added to one)";
const WINDOW_NOT_VISIBLE = "its window is not visible (it was hidden, or it was never shown)";
const WINDOW_NOT_ALLOCATED = "its window has not been allocated a size";
const NOT_MAPPED = "it is not mapped (it is not shown on screen, e.g. it is hidden or on a non-visible page)";
const BLOCKED_BY_MODAL = "its window is blocked by a modal window holding the grab";
const NOT_TARGETABLE = "it cannot receive pointer input (its can-target property is off)";
const ACTIONABLE_HOP_MS = 1;

type Failure = { reason: string; pointerTarget: Gtk.Widget | null };
type FailureFinder = (widget: Gtk.Widget) => Failure | null;

const pointerTargets: WeakMap<Error, Gtk.Widget> = new WeakMap();

const findWindowActionabilityFailure = (window: Gtk.Window): string | null => {
    if (!window.getVisible()) {
        return WINDOW_NOT_VISIBLE;
    }

    if (!isWindowAllocated(window)) {
        return WINDOW_NOT_ALLOCATED;
    }

    if (isWindowBlockedByModal(window)) {
        return BLOCKED_BY_MODAL;
    }

    return null;
};

const findRootActionabilityFailure = (root: Gtk.Root): string | null =>
    root instanceof Gtk.Window ? findWindowActionabilityFailure(root) : null;

const findActionabilityFailure = (widget: Gtk.Widget): string | null => {
    if (!widget.isSensitive()) {
        return NOT_SENSITIVE;
    }

    const root = widget.getRoot();

    if (root === null) {
        return NOT_ROOTED;
    }

    const rootFailure = findRootActionabilityFailure(root);

    if (rootFailure !== null) {
        return rootFailure;
    }

    return widget.getMapped() ? findDialogFailure(widget) : NOT_MAPPED;
};

const attribute = (key: string, value: string | null): string => (value === null ? "" : ` ${key}="${value}"`);

const widgetNameAttribute = (widget: Gtk.Widget): string => {
    const name = widget.getName();

    return attribute("name", isDefaultWidgetName(widget, name) ? null : name);
};

const describeWidget = (widget: Gtk.Widget): string => {
    const accessibleName = attribute("accessible-name", getWidgetAccessibleName(widget));
    const role = attribute("role", formatRole(widget.getAccessibleRole()));

    return `<${getTypeTag(widget)}${accessibleName}${widgetNameAttribute(widget)}${role}>`;
};

const visibleDialogOf = (widget: Gtk.Widget): Adw.Dialog | null => {
    const root = widget.getRoot();

    return root instanceof Adw.Window || root instanceof Adw.ApplicationWindow ? root.getVisibleDialog() : null;
};

const isBehindDialog = (widget: Gtk.Widget, dialog: Adw.Dialog | null): dialog is Adw.Dialog =>
    dialog !== null && widget !== dialog && !widget.isAncestor(dialog) && !dialog.isAncestor(widget);

const findDialogFailure = (widget: Gtk.Widget): string | null => {
    const dialog = visibleDialogOf(widget);

    return isBehindDialog(widget, dialog) ? `it is behind the modal dialog ${describeWidget(dialog)}` : null;
};

const describePointerBlocker = (widget: Gtk.Widget, blocker: Gtk.Widget): string => {
    if (blocker === widget) {
        return NOT_TARGETABLE;
    }

    return `it is inside ${describeWidget(blocker)}, which cannot receive pointer input (its can-target property is off)`;
};

const describePointerTarget = (target: Gtk.Widget | null): string =>
    target === null
        ? ""
        : `; a pointer there lands on ${describeWidget(target)}, its nearest ancestor that can receive pointer input`;

const blocked = (reason: string | null): Failure | null => (reason === null ? null : { reason, pointerTarget: null });

const findPointerFailure = (widget: Gtk.Widget): Failure | null => {
    const chain = [widget, ...ancestors(widget)];
    const blocker = chain.find((current) => !current.getCanTarget());

    if (blocker === undefined) {
        return null;
    }

    const pointerTarget = chain.findLast((current) => !current.getCanTarget())?.getParent() ?? null;

    return {
        reason: describePointerBlocker(widget, blocker) + describePointerTarget(pointerTarget),
        pointerTarget,
    };
};

const findEventActionabilityFailure = (widget: Gtk.Widget): Failure | null => blocked(findActionabilityFailure(widget));

const findPointerActionabilityFailure = (widget: Gtk.Widget): Failure | null =>
    findEventActionabilityFailure(widget) ?? findPointerFailure(widget);

const actionabilityError = (widget: Gtk.Widget, timeout: number, failure: Failure): Error => {
    const error = usageError(
        new Error(
            `Cannot dispatch user event: ${describeWidget(widget)} did not become actionable ` +
                `within ${String(timeout)}ms because ${failure.reason}`,
        ),
    );

    if (failure.pointerTarget !== null) {
        pointerTargets.set(error, failure.pointerTarget);
    }

    return error;
};

/**
 * The widget a real pointer would reach in place of the target of a refused pointer helper: the nearest ancestor
 * that can receive pointer input, when the error says the target is inside one that cannot.
 */
const getPointerTarget = (reason: unknown): Gtk.Widget | null =>
    (reason instanceof Error ? pointerTargets.get(reason) : undefined) ?? null;

const waitForActionable = async (widget: Gtk.Widget, findFailure: FailureFinder): Promise<void> => {
    const timeout = getConfig().actionabilityTimeout;
    const deadline = now() + timeout;
    let failure = findFailure(widget);

    while (failure !== null && now() < deadline) {
        await delay(ACTIONABLE_HOP_MS);
        failure = findFailure(widget);
    }

    if (failure !== null) {
        throw actionabilityError(widget, timeout, failure);
    }
};

const dispatchWhenActionable = async (
    widget: Gtk.Widget,
    findFailure: FailureFinder,
    body: () => void | PromiseLike<void>,
): Promise<void> => {
    await runWithActEnvironment(false, () => waitForActionable(widget, findFailure));

    await runInAct(async () => {
        await body();
    });
};

const wrapEvent = (widget: Gtk.Widget, body: () => void | PromiseLike<void>): Promise<void> =>
    dispatchWhenActionable(widget, findEventActionabilityFailure, body);

/**
 * Like {@link wrapEvent}, and also waits until a pointer could reach the widget: it is not behind an open Adwaita
 * dialog or inside a widget whose can-target property is off.
 */
const wrapPointerEvent = (widget: Gtk.Widget, body: () => void | PromiseLike<void>): Promise<void> =>
    dispatchWhenActionable(widget, findPointerActionabilityFailure, body);

export { getPointerTarget, wrapEvent, wrapPointerEvent };
