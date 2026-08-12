import * as Gtk from "@gtkx/gi/gtk";
import { scheduleNextFrame } from "../frame-sync.js";
import { getTypeTag } from "../widget-getters.js";
import { wrapEvent } from "./event-wrapper.js";

/** A scroll distance in pixels along each axis. */
type ScrollDelta = {
    /** Distance added to the horizontal adjustment. */
    x?: number;
    /** Distance added to the vertical adjustment. */
    y?: number;
};

type ScrollAdjustments = {
    horizontal: Gtk.Adjustment | null;
    vertical: Gtk.Adjustment | null;
};

/**
 * Emits a jump `change-value` so a Gtk.Range moves to the given value.
 *
 * @throws When the widget is not a Gtk.Range.
 */
const slide = (widget: Gtk.Widget, value: number): Promise<void> =>
    wrapEvent(widget, () => {
        if (!(widget instanceof Gtk.Range)) {
            throw new TypeError(
                `userEvent.slide requires a Gtk.Range (e.g. Gtk.Scale), got ${getTypeTag(widget)}`,
            );
        }

        widget.emit("change-value", Gtk.ScrollType.JUMP, value);
    });

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

const stepToward = (adjustment: Gtk.Adjustment, target: number, step: number): number => {
    const value = adjustment.getValue();
    adjustment.setValue(value < target ? Math.min(value + step, target) : Math.max(value - step, target));

    return adjustment.getValue();
};

const rampTo = (adjustment: Gtk.Adjustment, target: number, step: number): void => {
    let value = adjustment.getValue();

    while (value !== target) {
        const moved = stepToward(adjustment, target, step);

        if (moved === value) {
            return;
        }

        value = moved;
    }
};

const applyScrollDelta = (adjustment: Gtk.Adjustment | null, delta: number): void => {
    if (!adjustment || delta === 0) {
        return;
    }

    const pageSize = adjustment.getPageSize();
    rampTo(adjustment, adjustment.getValue() + delta, pageSize > 0 ? pageSize : Math.abs(delta));
};

/**
 * Adds the delta to the adjustments of the widget itself, or of its nearest Gtk.ScrolledWindow or
 * Gtk.Scrollable ancestor.
 *
 * Each adjustment advances in viewport-sized steps rather than one jump, so virtualized views such
 * as Gtk.ListView, Gtk.GridView and Gtk.ColumnView re-anchor onto the rows the new offset shows.
 *
 * @throws When neither the widget nor any of its ancestors is scrollable.
 */
const scroll = (widget: Gtk.Widget, delta: ScrollDelta): Promise<void> =>
    wrapEvent(widget, async () => {
        const adjustments = resolveScrollAdjustments(widget);

        if (!adjustments) {
            throw new Error(
                "userEvent.scroll: no Gtk.ScrolledWindow or Gtk.Scrollable found on the widget or its ancestors",
            );
        }

        applyScrollDelta(adjustments.horizontal, delta.x ?? 0);
        applyScrollDelta(adjustments.vertical, delta.y ?? 0);
        await scheduleNextFrame(widget);
    });

export { slide, scroll, type ScrollDelta };
