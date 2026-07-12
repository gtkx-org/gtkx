import * as Gtk from "@gtkx/gi/gtk";
import { wrapEvent } from "./event-wrapper.js";

export type ScrollDelta = {
    x?: number;
    y?: number;
};

export const slide = (widget: Gtk.Widget, value: number): Promise<void> =>
    wrapEvent(widget, () => {
        if (!(widget instanceof Gtk.Range)) {
            throw new Error(`userEvent.slide requires a Gtk.Range (e.g. Gtk.Scale), got ${widget.constructor.name}`);
        }
        widget.emit("change-value", Gtk.ScrollType.JUMP, value);
    });

type ScrollAdjustments = {
    horizontal: Gtk.Adjustment | null;
    vertical: Gtk.Adjustment | null;
};

const resolveScrollAdjustments = (widget: Gtk.Widget): ScrollAdjustments | null => {
    for (let current: Gtk.Widget | null = widget; current; current = current.getParent()) {
        if (current instanceof Gtk.ScrolledWindow) {
            return { horizontal: current.getHadjustment(), vertical: current.getVadjustment() };
        }
        if (current instanceof Gtk.Scrollable) {
            return { horizontal: current.getHadjustment(), vertical: current.getVadjustment() };
        }
    }
    return null;
};

const applyScrollDelta = (adjustment: Gtk.Adjustment | null, delta: number): void => {
    if (!adjustment || delta === 0) return;
    adjustment.setValue(adjustment.getValue() + delta);
};

export const scroll = (widget: Gtk.Widget, delta: ScrollDelta): Promise<void> =>
    wrapEvent(widget, () => {
        const adjustments = resolveScrollAdjustments(widget);
        if (!adjustments) {
            throw new Error(
                "userEvent.scroll: no Gtk.ScrolledWindow or Gtk.Scrollable found on the widget or its ancestors",
            );
        }
        applyScrollDelta(adjustments.horizontal, delta.x ?? 0);
        applyScrollDelta(adjustments.vertical, delta.y ?? 0);
    });
