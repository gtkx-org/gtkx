import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";
import type { ChildButtons } from "../../../src/demos/constraints/child-buttons.js";

const CHILD_BUTTON_LABELS = ["Child 1", "Child 2", "Child 3"];

const boundsIn = (widget: Gtk.Widget, container: Gtk.Widget) => {
    const [wasComputed, bounds] = widget.computeBounds(container);

    if (!wasComputed) {
        throw new Error("Could not compute widget bounds");
    }

    return bounds;
};

const findChildButtons = async (): Promise<ChildButtons> => ({
    button1: await screen.findByName("button1", { as: Gtk.Button }),
    button2: await screen.findByName("button2", { as: Gtk.Button }),
    button3: await screen.findByName("button3", { as: Gtk.Button }),
});

const findLabelledChildButtons = async (): Promise<Gtk.Button[]> => {
    const buttons: Gtk.Button[] = [];

    for (const name of CHILD_BUTTON_LABELS) {
        buttons.push(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name, as: Gtk.Button }));
    }

    return buttons;
};

export { boundsIn, CHILD_BUTTON_LABELS, findChildButtons, findLabelledChildButtons };
