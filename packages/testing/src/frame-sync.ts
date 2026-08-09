import type * as Gtk from "@gtkx/gi/gtk";
import * as GLib from "@gtkx/gi/glib";

const CLOCK_STALL_FALLBACK_MS = 500;

const once = (callback: () => void): (() => void) => {
    let isCalled = false;

    return () => {
        if (isCalled) {
            return;
        }

        isCalled = true;
        callback();
    };
};

const hasFrameClock = (widget: Gtk.Widget | null): widget is Gtk.Widget => widget?.getFrameClock() != null;
const isSized = (widget: Gtk.Widget): boolean => widget.getWidth() > 0;

const runUntilReady = (widget: Gtk.Widget, isReady: () => boolean, finish: () => void): void => {
    let tickId = 0;

    const fallback = setTimeout(() => {
        widget.removeTickCallback(tickId);
        finish();
    }, CLOCK_STALL_FALLBACK_MS);

    tickId = widget.addTickCallback(() => {
        if (!isReady()) {
            return GLib.SOURCE_CONTINUE;
        }

        clearTimeout(fallback);
        finish();

        return GLib.SOURCE_REMOVE;
    });
};

const scheduleNextFrame = (widget: Gtk.Widget): Promise<void> =>
    new Promise((resolve) => {
        const finish = once(resolve);

        if (!hasFrameClock(widget)) {
            queueMicrotask(finish);

            return;
        }

        runUntilReady(widget, () => true, finish);
    });

const scheduleAfterLayout = (widget: Gtk.Widget | null, callback: () => void): void => {
    const finish = once(callback);

    if (!hasFrameClock(widget) || isSized(widget)) {
        queueMicrotask(finish);

        return;
    }

    runUntilReady(widget, () => isSized(widget), finish);
};

export { scheduleAfterLayout, scheduleNextFrame };
