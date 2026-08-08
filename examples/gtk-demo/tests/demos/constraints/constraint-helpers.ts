import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";
import type { ChildButtons } from "../../../src/demos/constraints/child-buttons.js";

type ConstraintObserver = ReturnType<Gtk.ConstraintLayout["observeConstraints"]>;

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

const isConstraint = (item: unknown): item is Gtk.Constraint => item instanceof Gtk.Constraint;
const isGuide = (item: unknown): item is Gtk.ConstraintGuide => item instanceof Gtk.ConstraintGuide;

const collectListItems = <T>(model: ConstraintObserver, isMatch: (item: unknown) => item is T): T[] => {
    const items: T[] = [];

    for (let i = 0; i < model.getNItems(); i++) {
        const item = model.getItem(i);

        if (isMatch(item)) {
            items.push(item);
        }
    }

    return items;
};

const collectConstraints = (layout: Gtk.ConstraintLayout): Gtk.Constraint[] =>
    collectListItems(layout.observeConstraints(), isConstraint);

const collectGuides = (layout: Gtk.ConstraintLayout): Gtk.ConstraintGuide[] =>
    collectListItems(layout.observeGuides(), isGuide);

export {
    CHILD_BUTTON_LABELS,
    collectConstraints,
    collectGuides,
    findChildButtons,
    findContainerLayout,
    findLabelledChildButtons,
};
