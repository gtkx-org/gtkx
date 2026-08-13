import * as Gtk from "@gtkx/gi/gtk";

const WINDOW_NOT_ALLOCATED = "it was never allocated a size";
const WINDOW_NOT_ACTIVATED = "it never became active";
const NO_WINDOW_ACTIVATED = "no window of the application ever became active";

const canDisplayDeliverActivation = (window: Gtk.Window): boolean => window.getDisplay().getDefaultSeat() !== null;
const isWindow = (widget: Gtk.Widget): widget is Gtk.Window => widget instanceof Gtk.Window;

const mappedToplevels = (): Gtk.Window[] =>
    Gtk.Window.listToplevels().filter((widget) => isWindow(widget)).filter((window) => window.getMapped());

const isWindowAllocated = (window: Gtk.Window): boolean => {
    const [isComputed, allocation] = window.computeBounds(window);

    return isComputed && allocation.getWidth() > 0;
};

const activeToplevel = (): Gtk.Window | null => mappedToplevels().find((toplevel) => toplevel.isActive()) ?? null;

const isWindowActivated = (window: Gtk.Window): boolean =>
    !canDisplayDeliverActivation(window) || window.isActive();

const isApplicationActivated = (window: Gtk.Window): boolean =>
    !canDisplayDeliverActivation(window) || activeToplevel() !== null;

const isTransientDescendant = (window: Gtk.Window, ancestor: Gtk.Window): boolean => {
    for (let parent = window.getTransientFor(); parent !== null; parent = parent.getTransientFor()) {
        if (parent === ancestor) {
            return true;
        }
    }

    return false;
};

const isModalGrabHeldOver = (modal: Gtk.Window, window: Gtk.Window): boolean =>
    modal.getModal() &&
    modal !== window &&
    modal.getGroup() === window.getGroup() &&
    !isTransientDescendant(window, modal);

const isWindowBlockedByModal = (window: Gtk.Window): boolean =>
    mappedToplevels().some((toplevel) => isModalGrabHeldOver(toplevel, window));

const findPresentedWindowFailure = (window: Gtk.Window): string | null => {
    if (!isWindowAllocated(window)) {
        return WINDOW_NOT_ALLOCATED;
    }

    return isWindowActivated(window) ? null : WINDOW_NOT_ACTIVATED;
};

const findRenderedWindowFailure = (window: Gtk.Window): string | null => {
    if (!isWindowAllocated(window)) {
        return WINDOW_NOT_ALLOCATED;
    }

    return isApplicationActivated(window) ? null : NO_WINDOW_ACTIVATED;
};

export {
    activeToplevel,
    findPresentedWindowFailure,
    findRenderedWindowFailure,
    isWindowActivated,
    isWindowAllocated,
    isWindowBlockedByModal,
    mappedToplevels,
};
