import * as Gtk from "@gtkx/gi/gtk";
import { runInAct } from "../act.js";
import { getConfig } from "../config.js";
import { formatRole } from "../role-helpers.js";

const NOT_SENSITIVE = "it is not sensitive (the widget or one of its ancestors is disabled)";
const WINDOW_NOT_ALLOCATED = "its window has not been allocated a size";
const NOT_MAPPED = "it is not mapped (it is not shown on screen, e.g. it is hidden or on a non-visible page)";
const WINDOW_NOT_ACTIVE = "its window never became active";

const actionableHop = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 1));

const canDisplayDeliverActivation = (window: Gtk.Window): boolean =>
    window.getDisplay().getDefaultSeat() !== null;

const findWindowActionabilityFailure = (widget: Gtk.Widget, root: Gtk.Window): string | null => {
    if (root.getAllocatedWidth() === 0) {
        return WINDOW_NOT_ALLOCATED;
    }

    if (!widget.getMapped()) {
        return NOT_MAPPED;
    }

    if (canDisplayDeliverActivation(root) && !root.isActive()) {
        return WINDOW_NOT_ACTIVE;
    }

    return null;
};

const findActionabilityFailure = (widget: Gtk.Widget): string | null => {
    if (!widget.isSensitive()) {
        return NOT_SENSITIVE;
    }

    const root = widget.getRoot();

    if (!(root instanceof Gtk.Window) || !root.getVisible()) {
        return null;
    }

    return findWindowActionabilityFailure(widget, root);
};

const describeWidget = (widget: Gtk.Widget): string => {
    const tag = widget.constructor.name;
    const name = widget.getName();
    const nameAttribute = name && !name.endsWith(tag) ? ` name="${name}"` : "";

    return `<${tag}${nameAttribute} role="${formatRole(widget.getAccessibleRole())}">`;
};

const waitForActionable = async (widget: Gtk.Widget): Promise<void> => {
    const timeout = getConfig().actionabilityTimeout;
    const deadline = Date.now() + timeout;
    let failure = findActionabilityFailure(widget);

    while (failure !== null && Date.now() < deadline) {
        await actionableHop();
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
