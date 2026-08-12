import type * as Gtk from "@gtkx/gi/gtk";

const canDisplayDeliverActivation = (window: Gtk.Window): boolean => window.getDisplay().getDefaultSeat() !== null;

const isWindowAllocated = (window: Gtk.Window): boolean => {
    const [isComputed, allocation] = window.computeBounds(window);

    return isComputed && allocation.getWidth() > 0;
};

const isWindowActivated = (window: Gtk.Window): boolean =>
    !canDisplayDeliverActivation(window) || window.isActive();

const isWindowUsable = (window: Gtk.Window): boolean => isWindowAllocated(window) && isWindowActivated(window);

export { isWindowActivated, isWindowAllocated, isWindowUsable };
