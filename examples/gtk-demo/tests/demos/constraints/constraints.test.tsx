import * as Gtk from "@gtkx/gi/gtk";
import { screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { constraintsDemo } from "../../../src/demos/constraints/constraints.js";
import { renderDemo } from "../../test-utils.js";
import { collectConstraints, findChildButtons } from "./constraint-helpers.js";

type AllocatedLayout = {
    button1: Gtk.Button;
    button2: Gtk.Button;
    button3: Gtk.Button;
    container: Gtk.Box;
};

const getGridLayout = async (): Promise<Gtk.ConstraintLayout> => {
    const container = await screen.findByName("container");
    const layout = container.getLayoutManager();
    expect(layout).toBeInstanceOf(Gtk.ConstraintLayout);

    return layout as Gtk.ConstraintLayout;
};

const collectGuides = (layout: Gtk.ConstraintLayout): Gtk.ConstraintGuide[] => {
    const observer = layout.observeGuides();
    const guides: Gtk.ConstraintGuide[] = [];

    for (let i = 0; i < observer.getNItems(); i++) {
        const item = observer.getItem(i);

        if (item instanceof Gtk.ConstraintGuide) {
            guides.push(item);
        }
    }

    return guides;
};

const boundsIn = (widget: Gtk.Widget, container: Gtk.Widget) => {
    const [ok, rect] = widget.computeBounds(container);
    expect(ok, "expected computeBounds to succeed").toBe(true);

    return rect;
};

const findSpacingGuide = (layout: Gtk.ConstraintLayout): Gtk.ConstraintGuide => {
    const guides = collectGuides(layout);
    expect(guides).toHaveLength(1);
    const [guide] = guides;

    if (!guide) {
        throw new Error("expected the layout to register the 'space' guide");
    }

    return guide;
};

const renderAndAllocate = async (): Promise<AllocatedLayout> => {
    await renderDemo(constraintsDemo);
    const { button1, button2, button3 } = await findChildButtons();
    const container = (await screen.findByName("container")) as Gtk.Box;

    await waitFor(() => {
        expect(button3.getAllocatedWidth()).toBeGreaterThan(0);
    });

    return { button1, button2, button3, container };
};

describe("constraintsDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(constraintsDemo.id).toBe("constraints");
        expect(constraintsDemo.title).toBe("Constraints/Simple Constraints");
        expect(constraintsDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(constraintsDemo.keywords)).toBe(true);
        expect(typeof constraintsDemo.sourceCode).toBe("string");
        expect(constraintsDemo.defaultWidth).toBe(260);
        expect(constraintsDemo.keywords).toContain("GtkLayoutManager");
    });
});

describe("constraintsDemo layout", () => {
    it("caps button1 with a width <= 200 constraint on the layout", async () => {
        await renderDemo(constraintsDemo);
        const layout = await getGridLayout();
        const button1 = (await screen.findByName("button1")) as Gtk.Button;

        const maxWidth = collectConstraints(layout).find(
            (c) =>
                c.getTarget() === button1 &&
                c.getTargetAttribute() === Gtk.ConstraintAttribute.WIDTH &&
                c.getRelation() === Gtk.ConstraintRelation.LE,
        );

        expect(maxWidth, "expected a button1 width <= 200 constraint").toBeDefined();
        expect(maxWidth?.getConstant()).toBe(200);
        expect(maxWidth?.getSourceAttribute()).toBe(Gtk.ConstraintAttribute.NONE);
    });

    it("registers a single named spacing guide referenced by the horizontal constraints", async () => {
        await renderDemo(constraintsDemo);
        const layout = await getGridLayout();
        const guide = findSpacingGuide(layout);
        expect(guide.getName()).toBe("space");
        const constraints = collectConstraints(layout);

        const button1EndToGuide = constraints.find(
            (c) =>
                c.getSource() === guide &&
                c.getSourceAttribute() === Gtk.ConstraintAttribute.START &&
                c.getTargetAttribute() === Gtk.ConstraintAttribute.END,
        );

        const guideEndToButton2 = constraints.find(
            (c) =>
                c.getTarget() === guide &&
                c.getTargetAttribute() === Gtk.ConstraintAttribute.END &&
                c.getSourceAttribute() === Gtk.ConstraintAttribute.START,
        );

        expect(button1EndToGuide, "expected button1.end pinned to space.start").toBeDefined();
        expect(guideEndToButton2, "expected space.end pinned to button2.start").toBeDefined();
    });

    it("adds exactly the 15 declared constraints to the layout", async () => {
        await renderDemo(constraintsDemo);
        const layout = await getGridLayout();
        expect(collectConstraints(layout)).toHaveLength(15);
    });
});

describe("constraintsDemo geometry", () => {
    it("resolves the constraints into the intended allocations", async () => {
        const { button1, button2, button3, container } = await renderAndAllocate();
        const containerWidth = container.getAllocatedWidth();
        const b1 = boundsIn(button1, container);
        const b2 = boundsIn(button2, container);
        const b3 = boundsIn(button3, container);
        expect(button1.getAllocatedWidth()).toBe(button2.getAllocatedWidth());
        expect(b1.getX()).toBe(8);
        expect(b2.getX() + b2.getWidth()).toBe(containerWidth - 8);
        expect(b2.getX()).toBeGreaterThan(b1.getX() + b1.getWidth());
        expect(b3.getX()).toBe(8);
        expect(b3.getWidth()).toBe(containerWidth - 16);
        expect(b3.getY()).toBeGreaterThan(b1.getY() + b1.getHeight());
    });

    it("recomputes the layout when the window is resized", async () => {
        const { button1, button2, button3, container } = await renderAndAllocate();
        const initialContainerWidth = container.getAllocatedWidth();
        const initialButton1Width = button1.getAllocatedWidth();
        const widerWidth = initialContainerWidth + 240;
        const root = container.getRoot();

        if (!(root instanceof Gtk.Window)) {
            throw new TypeError("expected the demo container to have a window root");
        }

        root.setDefaultSize(widerWidth, 400);

        await waitFor(() => {
            expect(container.getAllocatedWidth()).toBe(widerWidth);
        });

        expect(button3.getAllocatedWidth()).toBe(widerWidth - 16);
        expect(button1.getAllocatedWidth()).toBeGreaterThan(initialButton1Width);
        expect(button1.getAllocatedWidth()).toBe(button2.getAllocatedWidth());
    });
});

describe("constraintsDemo children", () => {
    it("renders the three child buttons inside the grid", async () => {
        await renderDemo(constraintsDemo);
        const child1 = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Child 1" })) as Gtk.Button;
        const child2 = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Child 2" })) as Gtk.Button;
        const child3 = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Child 3" })) as Gtk.Button;
        expect(child1.getLabel()).toBe("Child 1");
        expect(child2.getLabel()).toBe("Child 2");
        expect(child3.getLabel()).toBe("Child 3");
    });
});
