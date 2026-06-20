import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";
import { expect } from "vitest";

export interface ChildButtons {
    button1: Gtk.Button;
    button2: Gtk.Button;
    button3: Gtk.Button;
}

export const findChildButtons = async (): Promise<ChildButtons> => ({
    button1: (await screen.findByName("button1")) as Gtk.Button,
    button2: (await screen.findByName("button2")) as Gtk.Button,
    button3: (await screen.findByName("button3")) as Gtk.Button,
});

export const expectChildButtonLabels = async (): Promise<void> => {
    const { button1, button2, button3 } = await findChildButtons();
    expect(button1.getLabel()).toBe("Child 1");
    expect(button2.getLabel()).toBe("Child 2");
    expect(button3.getLabel()).toBe("Child 3");
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
