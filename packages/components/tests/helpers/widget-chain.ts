import * as Gtk from "@gtkx/gi/gtk";
import { expect } from "vitest";

const expectNoBoxBetween = (widget: Gtk.Widget, ancestor: Gtk.Widget): void => {
    let current: Gtk.Widget | null = widget;

    while (current !== null && current !== ancestor) {
        expect(current).not.toBeInstanceOf(Gtk.Box);
        current = current.getParent();
    }

    expect(current).toBe(ancestor);
};

export { expectNoBoxBetween };
