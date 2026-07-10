import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";

export type ChildButtons = {
    button1: Gtk.Button;
    button2: Gtk.Button;
    button3: Gtk.Button;
};

export const findChildButtons = async (): Promise<ChildButtons> => ({
    button1: (await screen.findByName("button1")) as Gtk.Button,
    button2: (await screen.findByName("button2")) as Gtk.Button,
    button3: (await screen.findByName("button3")) as Gtk.Button,
});

export const expectChildButtonLabels = async (): Promise<void> => {
    await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Child 1" });
    await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Child 2" });
    await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Child 3" });
};

export const findContainerLayout = async (): Promise<{ box: Gtk.Box; layout: Gtk.ConstraintLayout }> => {
    const box = (await screen.findByName("container")) as Gtk.Box;
    return { box, layout: box.getLayoutManager() as Gtk.ConstraintLayout };
};

export const collectConstraints = (layout: Gtk.ConstraintLayout): Gtk.Constraint[] => {
    const observer = layout.observeConstraints();
    const constraints: Gtk.Constraint[] = [];
    for (let i = 0; i < observer.getNItems(); i++) {
        const item = observer.getItem(i);
        if (item instanceof Gtk.Constraint) constraints.push(item);
    }
    return constraints;
};
