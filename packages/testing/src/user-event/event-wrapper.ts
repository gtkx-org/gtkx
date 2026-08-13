import * as Gtk from "@gtkx/gi/gtk";
import { runInAct } from "../act.js";
import { getConfig } from "../config.js";
import { formatRole } from "../role-helpers.js";
import { delay, now } from "../timers.js";
import { getWidgetAccessibleName } from "../widget-accessible-properties.js";
import { getTypeTag, isDefaultWidgetName } from "../widget-getters.js";
import { isWindowAllocated, isWindowBlockedByModal } from "../window-state.js";

const NOT_SENSITIVE = "it is not sensitive (the widget or one of its ancestors is disabled)";
const NOT_ROOTED = "it is not inside a toplevel (it was removed from the widget tree, or was never added to one)";
const WINDOW_NOT_VISIBLE = "its window is not visible (it was hidden, or it was never shown)";
const WINDOW_NOT_ALLOCATED = "its window has not been allocated a size";
const NOT_MAPPED = "it is not mapped (it is not shown on screen, e.g. it is hidden or on a non-visible page)";
const BLOCKED_BY_MODAL = "its window is blocked by a modal window holding the grab";
const ACTIONABLE_HOP_MS = 1;

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

    return widget.getMapped() ? null : NOT_MAPPED;
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

const waitForActionable = async (widget: Gtk.Widget): Promise<void> => {
    const timeout = getConfig().actionabilityTimeout;
    const deadline = now() + timeout;
    let failure = findActionabilityFailure(widget);

    while (failure !== null && now() < deadline) {
        await delay(ACTIONABLE_HOP_MS);
        failure = findActionabilityFailure(widget);
    }

    if (failure !== null) {
        throw new Error(
            `Cannot dispatch user event: ${describeWidget(widget)} did not become actionable ` +
            `within ${String(timeout)}ms because ${failure}`,
        );
    }
};

const wrapEvent = async (widget: Gtk.Widget, body: () => void | PromiseLike<void>): Promise<void> => {
    await waitForActionable(widget);

    await runInAct(async () => {
        await body();
    });
};

export { wrapEvent };
