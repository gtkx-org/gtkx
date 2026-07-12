import * as Gtk from "@gtkx/gi/gtk";
import { getOrCreateController, queryController } from "./controller.js";
import { wrapEvent } from "./event-wrapper.js";

export const emitPress = (controller: Gtk.GestureClick, nPress: number): void => {
    controller.emit("pressed", nPress, 0, 0);
};

export const emitRelease = (controller: Gtk.GestureClick, nPress: number): void => {
    controller.emit("released", nPress, 0, 0);
};

const emitClickSequence = (widget: Gtk.Widget, target: Gtk.Widget, nPress: number): Promise<void> =>
    wrapEvent(widget, () => {
        const controller = getOrCreateController(target, Gtk.GestureClick);

        for (let i = 1; i <= nPress; i++) {
            emitPress(controller, i);
            emitRelease(controller, i);
        }
    });

const findClickableAncestor = (widget: Gtk.Widget): Gtk.Widget | null => {
    let current = widget.getParent();
    while (current) {
        if (current instanceof Gtk.Button || queryController(current, Gtk.GestureClick) !== null) {
            return current;
        }
        current = current.getParent();
    }
    return null;
};

/**
 * Simulates a primary click on the widget: activates buttons, toggles switches, calls the default activation, or dispatches a click gesture to the widget or its nearest clickable ancestor.
 * @param widget Widget to click.
 */
export const click = async (widget: Gtk.Widget): Promise<void> => {
    if (widget instanceof Gtk.Button) {
        await emitClickSequence(widget, widget, 1);
        return;
    }
    if (widget instanceof Gtk.Switch) {
        await wrapEvent(widget, () => {
            widget.setActive(!widget.getActive());
        });
        return;
    }
    if (widget.getAccessibleRole() !== Gtk.AccessibleRole.LABEL) {
        let activated = false;
        await wrapEvent(widget, () => {
            activated = widget.activate();
        });
        if (activated) return;
    }
    const target = findClickableAncestor(widget);
    if (target) await emitClickSequence(widget, target, 1);
};

/** Simulates a double click (two press and release cycles) on the widget. */
export const dblClick = (widget: Gtk.Widget): Promise<void> => emitClickSequence(widget, widget, 2);
/** Simulates a triple click (three press and release cycles) on the widget. */
export const tripleClick = (widget: Gtk.Widget): Promise<void> => emitClickSequence(widget, widget, 3);
