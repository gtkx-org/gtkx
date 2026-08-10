import * as Gtk from "@gtkx/gi/gtk";

type ClickGestureCounts = { pressed: number; released: number };

const attachClickGesture = (widget: Gtk.Widget): ClickGestureCounts => {
    const counts = { pressed: 0, released: 0 };
    const gesture = new Gtk.GestureClick();

    gesture.connect("pressed", () => {
        counts.pressed += 1;
    });

    gesture.connect("released", () => {
        counts.released += 1;
    });

    widget.addController(gesture);

    return counts;
};

export { attachClickGesture };
