import * as Gtk from "@gtkx/gi/gtk";
import { screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { constraintsDemo } from "../../../src/demos/constraints/constraints.js";
import { renderDemo } from "../../test-utils.js";
import { boundsIn, findChildButtons } from "./constraint-helpers.js";

const EDGE_SPACING = 8;
const ROW_GAP = 12;
const MIN_COLUMN_GAP = 10;
const MAX_COLUMN_GAP = 200;
const MAX_BUTTON_WIDTH = 200;

type AllocatedLayout = {
    button1: Gtk.Button;
    button2: Gtk.Button;
    button3: Gtk.Button;
    container: Gtk.Box;
    containerHeight: number;
    containerWidth: number;
};

const renderAndAllocate = async (): Promise<AllocatedLayout> => {
    await renderDemo(constraintsDemo);
    const { button1, button2, button3 } = await findChildButtons();
    const container = await screen.findByName("container", { as: Gtk.Box });

    await waitFor(() => {
        expect(button3.getWidth()).toBeGreaterThan(0);
    });

    return {
        button1,
        button2,
        button3,
        container,
        containerHeight: container.getHeight(),
        containerWidth: container.getWidth(),
    };
};

const renderAndMeasure = async () => {
    const layout = await renderAndAllocate();

    return {
        b1: boundsIn(layout.button1, layout.container),
        b2: boundsIn(layout.button2, layout.container),
        b3: boundsIn(layout.button3, layout.container),
        containerHeight: layout.containerHeight,
        containerWidth: layout.containerWidth,
    };
};

describe("constraintsDemo geometry", () => {
    it("resolves the constraints into the intended allocations", async () => {
        const { b1, b2, b3, containerHeight, containerWidth } = await renderAndMeasure();
        expect(b1.getWidth()).toBe(b2.getWidth());
        expect(b1.getHeight()).toBe(b2.getHeight());
        expect(b1.getHeight()).toBe(b3.getHeight());
        expect(b1.getWidth()).toBeLessThanOrEqual(MAX_BUTTON_WIDTH);
        expect(b1.getX()).toBe(EDGE_SPACING);
        expect(b1.getY()).toBe(EDGE_SPACING);
        expect(b2.getX() + b2.getWidth()).toBe(containerWidth - EDGE_SPACING);
        expect(b2.getX() - (b1.getX() + b1.getWidth())).toBeGreaterThanOrEqual(MIN_COLUMN_GAP);
        expect(b2.getX() - (b1.getX() + b1.getWidth())).toBeLessThanOrEqual(MAX_COLUMN_GAP);
        expect(b3.getX()).toBe(EDGE_SPACING);
        expect(b3.getWidth()).toBe(containerWidth - EDGE_SPACING * 2);
        expect(b3.getY() - (b1.getY() + b1.getHeight())).toBe(ROW_GAP);
        expect(b3.getY() + b3.getHeight()).toBe(containerHeight - EDGE_SPACING);
    });

    it("recomputes the layout when the window is resized", async () => {
        const { button1, button2, button3, container } = await renderAndAllocate();
        const widerWidth = MAX_BUTTON_WIDTH * 2 + MAX_COLUMN_GAP + EDGE_SPACING * 2;
        const initialButton1Width = boundsIn(button1, container).getWidth();
        const root = container.getRoot();

        if (!(root instanceof Gtk.Window)) {
            throw new TypeError("expected the demo container to have a window root");
        }

        root.setDefaultSize(widerWidth, 400);

        await waitFor(() => {
            expect(container.getWidth()).toBe(widerWidth);
        });

        expect(boundsIn(button3, container).getWidth()).toBe(widerWidth - EDGE_SPACING * 2);
        expect(boundsIn(button1, container).getWidth()).toBeGreaterThan(initialButton1Width);
        expect(boundsIn(button1, container).getWidth()).toBe(MAX_BUTTON_WIDTH);
        expect(boundsIn(button1, container).getWidth()).toBe(boundsIn(button2, container).getWidth());
        expect(boundsIn(button2, container).getX() + boundsIn(button2, container).getWidth()).toBe(
            widerWidth - EDGE_SPACING,
        );
    });
});

describe("constraintsDemo children", () => {
    it("renders the three child buttons inside the grid", async () => {
        await renderDemo(constraintsDemo);
        const child1 = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Child 1", as: Gtk.Button });
        const child2 = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Child 2", as: Gtk.Button });
        const child3 = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Child 3", as: Gtk.Button });
        expect(child1).toHaveTextContent("Child 1");
        expect(child2).toHaveTextContent("Child 2");
        expect(child3).toHaveTextContent("Child 3");
        expect(child1).toAppearBefore(child2);
        expect(child2).toAppearBefore(child3);
    });
});
