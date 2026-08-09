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

const runWhenSized = (widget: Gtk.Widget, finish: () => void): void => {
    let tickId = 0;

    const fallback = setTimeout(() => {
        widget.removeTickCallback(tickId);
        finish();
    }, CLOCK_STALL_FALLBACK_MS);

    tickId = widget.addTickCallback(() => {
        if (widget.getWidth() === 0) {
            return GLib.SOURCE_CONTINUE;
        }

        clearTimeout(fallback);
        finish();

        return GLib.SOURCE_REMOVE;
    });
};

const runOnNextFrame = (widget: Gtk.Widget, finish: () => void): void => {
    let tickId = 0;

    const fallback = setTimeout(() => {
        widget.removeTickCallback(tickId);
        finish();
    }, CLOCK_STALL_FALLBACK_MS);

    tickId = widget.addTickCallback(() => {
        clearTimeout(fallback);
        finish();

        return GLib.SOURCE_REMOVE;
    });
};

const scheduleNextFrame = (widget: Gtk.Widget): Promise<void> =>
    new Promise((resolve) => {
        const finish = once(resolve);

        if (widget.getFrameClock() == null) {
            queueMicrotask(finish);

            return;
        }

        runOnNextFrame(widget, finish);
    });

const scheduleAfterLayout = (widget: Gtk.Widget | null, callback: () => void): void => {
    const finish = once(callback);

    if (widget?.getFrameClock() == null || widget.getWidth() > 0) {
        queueMicrotask(finish);

        return;
    }

    runWhenSized(widget, finish);
};

export { scheduleAfterLayout, scheduleNextFrame };
