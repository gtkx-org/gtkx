import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";

type ChildButtons = {
    button1: Gtk.Button;
    button2: Gtk.Button;
    button3: Gtk.Button;
};

const CHILD_BUTTON_LABELS = ["Child 1", "Child 2", "Child 3"];

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

const findContainerLayout = async (): Promise<{ box: Gtk.Box; layout: Gtk.ConstraintLayout }> => {
    const box = await screen.findByName("container", { as: Gtk.Box });

    return { box, layout: box.getLayoutManager() as Gtk.ConstraintLayout };
};

const collectConstraints = (layout: Gtk.ConstraintLayout): Gtk.Constraint[] => {
    const observer = layout.observeConstraints();
    const constraints: Gtk.Constraint[] = [];

    for (let i = 0; i < observer.getNItems(); i++) {
        const item = observer.getItem(i);

        if (item instanceof Gtk.Constraint) {
            constraints.push(item);
        }
    }

    return constraints;
};

export {
    CHILD_BUTTON_LABELS,
    type ChildButtons,
    collectConstraints,
    findChildButtons,
    findContainerLayout,
    findLabelledChildButtons,
};
