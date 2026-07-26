import type * as Gtk from "@gtkx/gi/gtk";

const CLOCK_STALL_FALLBACK_MS = 500;

export const scheduleAfterLayout = (widget: Gtk.Widget | null, callback: () => void): void => {
    let done = false;
    let removeTick: (() => void) | null = null;
    let fallback: ReturnType<typeof setTimeout> | null = null;

    const finish = (): void => {
        if (done) return;
        done = true;
        if (fallback !== null) clearTimeout(fallback);
        removeTick?.();
        removeTick = null;
        fallback = null;
        callback();
    };

    if (widget?.getFrameClock() == null || widget.getWidth() > 0) {
        queueMicrotask(finish);
        return;
    }

    fallback = setTimeout(finish, CLOCK_STALL_FALLBACK_MS);

    const tickId = widget.addTickCallback(() => {
        if (widget.getWidth() === 0) return true;
        finish();
        return false;
    });

    removeTick = () => widget.removeTickCallback(tickId);
};
