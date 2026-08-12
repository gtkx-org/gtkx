import * as Gtk from "@gtkx/gi/gtk";

const canDisplayDeliverActivation = (window: Gtk.Window): boolean => window.getDisplay().getDefaultSeat() !== null;
const isWindow = (widget: Gtk.Widget): widget is Gtk.Window => widget instanceof Gtk.Window;

const mappedToplevels = (): Gtk.Window[] =>
    Gtk.Window.listToplevels().filter((widget) => isWindow(widget)).filter((window) => window.getMapped());

const isWindowAllocated = (window: Gtk.Window): boolean => {
    const [isComputed, allocation] = window.computeBounds(window);

    return isComputed && allocation.getWidth() > 0;
};

const isWindowActivated = (window: Gtk.Window): boolean =>
    !canDisplayDeliverActivation(window) || window.isActive();

const isDisplayActivated = (window: Gtk.Window): boolean =>
    !canDisplayDeliverActivation(window) || mappedToplevels().some((toplevel) => toplevel.isActive());

const isTransientDescendant = (window: Gtk.Window, ancestor: Gtk.Window): boolean => {
    for (let parent = window.getTransientFor(); parent !== null; parent = parent.getTransientFor()) {
        if (parent === ancestor) {
            return true;
        }
    }

    return false;
};

const isGrabHeldOver = (window: Gtk.Window, modal: Gtk.Window): boolean =>
    modal !== window && !isTransientDescendant(window, modal);

const isWindowBlockedByModal = (window: Gtk.Window): boolean =>
    mappedToplevels().some((toplevel) => toplevel.getModal() && isGrabHeldOver(window, toplevel));

const isWindowUsable = (window: Gtk.Window): boolean => isWindowAllocated(window) && isWindowActivated(window);

export {
    isDisplayActivated,
    isWindowActivated,
    isWindowAllocated,
    isWindowBlockedByModal,
    isWindowUsable,
    mappedToplevels,
};
