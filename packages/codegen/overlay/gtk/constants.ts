/**
 * Return value for an event handler that allows the event to continue
 * propagating to the next handler. Mirrors `GTK_EVENT_PROPAGATE` /
 * node-gtk's `Gtk.EVENT_CONTINUE`.
 */
export const EVENT_CONTINUE = false;

/**
 * Return value for an event handler that stops further propagation of
 * the event. Mirrors `GTK_EVENT_STOP` / node-gtk's `Gtk.EVENT_STOP`.
 */
export const EVENT_STOP = true;
