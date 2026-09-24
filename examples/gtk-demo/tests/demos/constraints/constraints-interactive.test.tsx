import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { constraintsInteractiveDemo } from "../../../src/demos/constraints/constraints-interactive.js";
import { renderDemo } from "../../test-utils.js";
import { boundsIn, CHILD_BUTTON_LABELS, findChildButtons, findLabelledChildButtons } from "./constraint-helpers.js";

const EDGE_SPACING = 8;

const renderInteractiveDemo = async () => {
    await renderDemo(constraintsInteractiveDemo);
    const container = await screen.findByName("container", { as: Gtk.Box });
    const buttons = await findChildButtons();

    await waitFor(() => {
        expect(container.getWidth()).toBeGreaterThan(0);
    });

    return { ...buttons, container };
};

describe("constraintsInteractiveDemo content", () => {
    it("renders three button children with the expected labels", async () => {
        await renderDemo(constraintsInteractiveDemo);
        const buttons = await findLabelledChildButtons();
        expect(buttons.map((button) => button.getLabel())).toEqual(CHILD_BUTTON_LABELS);
    });
});

describe("constraintsInteractiveDemo dragging", () => {
    it("lays out the buttons around the dragged divider", async () => {
        const { button1, button2, button3, container } = await renderInteractiveDemo();
        const dividerX = Math.floor(container.getWidth() * 0.6);
        await userEvent.drag(container, 30, 0, { startX: dividerX - 30 });

        await waitFor(() => {
            expect(boundsIn(button1, container).getX() + boundsIn(button1, container).getWidth()).toBe(dividerX);
        });

        const b1 = boundsIn(button1, container);
        const b2 = boundsIn(button2, container);
        const b3 = boundsIn(button3, container);
        expect(b1.getX()).toBe(EDGE_SPACING);
        expect(b3.getX()).toBe(EDGE_SPACING);
        expect(b1.getX() + b1.getWidth()).toBe(dividerX);
        expect(b3.getX() + b3.getWidth()).toBe(dividerX);
        expect(b2.getX()).toBe(dividerX);
        expect(b2.getX() + b2.getWidth()).toBe(container.getWidth() - EDGE_SPACING);
        expect(b1.getY()).toBe(EDGE_SPACING);
        expect(b2.getY()).toBe(b1.getY() + b1.getHeight());
        expect(b3.getY()).toBe(b2.getY() + b2.getHeight());
        expect(b3.getY() + b3.getHeight()).toBe(container.getHeight() - EDGE_SPACING);
    });

    it("moves the visible divider when dragged again", async () => {
        const { button1, button2, button3, container } = await renderInteractiveDemo();
        await userEvent.drag(container, 0, 0, { startX: 90 });

        await waitFor(() => {
            expect(boundsIn(button1, container).getWidth()).toBe(90 - EDGE_SPACING);
        });

        await userEvent.drag(container, 70, 0, { startX: 90 });

        await waitFor(() => {
            expect(boundsIn(button1, container).getWidth()).toBe(160 - EDGE_SPACING);
        });

        expect(boundsIn(button2, container).getX()).toBe(160);
        expect(boundsIn(button3, container).getWidth()).toBe(160 - EDGE_SPACING);
    });
});
