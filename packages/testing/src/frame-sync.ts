import type * as Gtk from "@gtkx/gi/gtk";

const CLOCK_STALL_FALLBACK_MS = 500;

const once = (callback: () => void): (() => void) => {
    let called = false;

    return () => {
        if (called) return;
        called = true;
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
        if (widget.getWidth() === 0) return true;
        clearTimeout(fallback);
        finish();

        return false;
    });
};

const scheduleAfterLayout = (widget: Gtk.Widget | null, callback: () => void): void => {
    const finish = once(callback);

    if (widget?.getFrameClock() == null || widget.getWidth() > 0) {
        queueMicrotask(finish);

        return;
    }

    runWhenSized(widget, finish);
};

export { scheduleAfterLayout };
