import * as Gtk from "@gtkx/gi/gtk";
import { act } from "./act.js";
import { findExistingController, getOrCreateController } from "./controller.js";

export const emitPress = (controller: Gtk.GestureClick, nPress: number): void => {
    controller.emit("pressed", nPress, 0, 0);
};

export const emitRelease = (controller: Gtk.GestureClick, nPress: number): void => {
    controller.emit("released", nPress, 0, 0);
};

const emitClickSequence = async (widget: Gtk.Widget, nPress: number): Promise<void> => {
    await act(() => {
        const controller = getOrCreateController(widget, Gtk.GestureClick);

        for (let i = 1; i <= nPress; i++) {
            emitPress(controller, i);
            emitRelease(controller, i);
        }
    });
};

const findClickableAncestor = (widget: Gtk.Widget): Gtk.Widget | null => {
    let current = widget.getParent();
    while (current) {
        if (current instanceof Gtk.Button || findExistingController(current, Gtk.GestureClick) !== null) {
            return current;
        }
        current = current.getParent();
    }
    return null;
};

/**
 * Activates a widget.
 *
 * Uses GTK's native `Gtk.Widget.activate()` to trigger the widget's
 * default action — clicking buttons, toggling checkboxes/switches, etc.
 *
 * `Gtk.Button` (and subclasses) are special-cased to a synchronous
 * `pressed`/`released` click-gesture sequence instead, so the `clicked`
 * signal fires immediately rather than behind GtkButton's unconditional
 * 250ms keyboard-activation timeout, which races test wait windows under
 * load.
 *
 * A widget that handles neither — a label inside a button, say —
 * resolves upward to the nearest ancestor that is a button or carries a
 * click gesture, mirroring how a click on text reaches the enclosing
 * control's handler in the DOM and in React Native. So
 * `click(getByText("Save"))` activates the button that renders the text.
 *
 * @param widget - The widget to activate.
 */
export const click = async (widget: Gtk.Widget): Promise<void> => {
    if (widget instanceof Gtk.Button) {
        await emitClickSequence(widget, 1);
        return;
    }
    if (widget.getAccessibleRole() !== Gtk.AccessibleRole.LABEL) {
        let activated = false;
        await act(() => {
            activated = widget.activate();
        });
        if (activated) return;
    }
    const target = findClickableAncestor(widget);
    if (target) await emitClickSequence(target, 1);
};

/**
 * Double-clicks a widget.
 *
 * Emits pressed/released signals with n_press=1, then n_press=2.
 *
 * @param widget - The widget to double-click.
 */
export const dblClick = (widget: Gtk.Widget): Promise<void> => emitClickSequence(widget, 2);

/**
 * Triple-clicks a widget.
 *
 * Emits pressed/released signals with n_press=1, 2, then 3. Useful for text selection.
 *
 * @param widget - The widget to triple-click.
 */
export const tripleClick = (widget: Gtk.Widget): Promise<void> => emitClickSequence(widget, 3);
