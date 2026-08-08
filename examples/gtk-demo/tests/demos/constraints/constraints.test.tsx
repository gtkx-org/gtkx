import * as Gtk from "@gtkx/gi/gtk";
import { screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { constraintsDemo } from "../../../src/demos/constraints/constraints.js";
import { renderDemo } from "../../test-utils.js";
import { collectConstraints, collectGuides, findChildButtons } from "./constraint-helpers.js";

type AllocatedLayout = {
    button1: Gtk.Button;
    button2: Gtk.Button;
    button3: Gtk.Button;
    container: Gtk.Box;
    containerWidth: number;
};

const getGridLayout = async (): Promise<Gtk.ConstraintLayout> => {
    const container = await screen.findByName("container");
    const layout = container.getLayoutManager();
    expect(layout).toBeInstanceOf(Gtk.ConstraintLayout);

    return layout as Gtk.ConstraintLayout;
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
    const container = await screen.findByName("container", { as: Gtk.Box });

    await waitFor(() => {
        expect(button3.getWidth()).toBeGreaterThan(0);
    });

    return { button1, button2, button3, container, containerWidth: container.getWidth() };
};

const renderAndMeasure = async () => {
    const layout = await renderAndAllocate();

    return {
        b1: boundsIn(layout.button1, layout.container),
        b2: boundsIn(layout.button2, layout.container),
        b3: boundsIn(layout.button3, layout.container),
        containerWidth: layout.containerWidth,
    };
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
        const button1 = await screen.findByName("button1", { as: Gtk.Button });

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
        const { b1, b2, b3, containerWidth } = await renderAndMeasure();
        expect(b1.getWidth()).toBe(b2.getWidth());
        expect(b1.getX()).toBe(8);
        expect(b2.getX() + b2.getWidth()).toBe(containerWidth - 8);
        expect(b2.getX()).toBeGreaterThan(b1.getX() + b1.getWidth());
        expect(b3.getX()).toBe(8);
        expect(b3.getWidth()).toBe(containerWidth - 16);
        expect(b3.getY()).toBeGreaterThan(b1.getY() + b1.getHeight());
    });

    it("recomputes the layout when the window is resized", async () => {
        const { button1, button2, button3, container, containerWidth } = await renderAndAllocate();
        const widerWidth = containerWidth + 240;
        const initialButton1Width = boundsIn(button1, container).getWidth();
        const root = container.getRoot();

        if (!(root instanceof Gtk.Window)) {
            throw new TypeError("expected the demo container to have a window root");
        }

        root.setDefaultSize(widerWidth, 400);

        await waitFor(() => {
            expect(container.getWidth()).toBe(widerWidth);
        });

        expect(boundsIn(button3, container).getWidth()).toBe(widerWidth - 16);
        expect(boundsIn(button1, container).getWidth()).toBeGreaterThan(initialButton1Width);
        expect(boundsIn(button1, container).getWidth()).toBe(boundsIn(button2, container).getWidth());
    });
});

describe("constraintsDemo children", () => {
    it("renders the three child buttons inside the grid", async () => {
        await renderDemo(constraintsDemo);
        const child1 = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Child 1", as: Gtk.Button });
        const child2 = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Child 2", as: Gtk.Button });
        const child3 = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Child 3", as: Gtk.Button });
        expect(child1).toHaveObjectProperty("label", "Child 1");
        expect(child2).toHaveObjectProperty("label", "Child 2");
        expect(child3).toHaveObjectProperty("label", "Child 3");
    });
});
