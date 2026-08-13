import * as Gtk from "@gtkx/gi/gtk";
import { runInAct } from "../act.js";
import { getConfig } from "../config.js";
import { formatRole } from "../role-helpers.js";
import { delay, now } from "../timers.js";
import { getTypeTag, isDefaultWidgetName } from "../widget-getters.js";
import { isDisplayActivated, isWindowAllocated, isWindowBlockedByModal } from "../window-state.js";

const NOT_SENSITIVE = "it is not sensitive (the widget or one of its ancestors is disabled)";
const WINDOW_NOT_ALLOCATED = "its window has not been allocated a size";
const NOT_MAPPED = "it is not mapped (it is not shown on screen, e.g. it is hidden or on a non-visible page)";
const NOT_IN_VISIBLE_WINDOW = "it is not attached to a visible window (it was removed from the tree or never shown)";
const NO_WINDOW_ACTIVATED = "no window of the application ever became active";
const BLOCKED_BY_MODAL = "its window is blocked by a modal window holding the grab";
const ACTIONABLE_HOP_MS = 1;

const findWindowActionabilityFailure = (widget: Gtk.Widget, root: Gtk.Window): string | null => {
    if (!isWindowAllocated(root)) {
        return WINDOW_NOT_ALLOCATED;
    }

    if (!widget.getMapped()) {
        return NOT_MAPPED;
    }

    if (!isDisplayActivated(root)) {
        return NO_WINDOW_ACTIVATED;
    }

    if (isWindowBlockedByModal(root)) {
        return BLOCKED_BY_MODAL;
    }

    return null;
};

const findActionabilityFailure = (widget: Gtk.Widget): string | null => {
    if (!widget.isSensitive()) {
        return NOT_SENSITIVE;
    }

    const root = widget.getRoot();

    if (!(root instanceof Gtk.Window) || !root.getVisible()) {
        return NOT_IN_VISIBLE_WINDOW;
    }

    return findWindowActionabilityFailure(widget, root);
};

const describeWidget = (widget: Gtk.Widget): string => {
    const tag = getTypeTag(widget);
    const name = widget.getName();
    const nameAttribute = isDefaultWidgetName(widget, name) ? "" : ` name="${name}"`;

    return `<${tag}${nameAttribute} role="${formatRole(widget.getAccessibleRole())}">`;
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
