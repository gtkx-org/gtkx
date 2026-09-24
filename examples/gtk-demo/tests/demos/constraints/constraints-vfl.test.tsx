import * as Gtk from "@gtkx/gi/gtk";
import { screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import type { ChildButtons } from "../../../src/demos/constraints/child-buttons.js";
import { constraintsVflDemo } from "../../../src/demos/constraints/constraints-vfl.js";
import { renderDemo } from "../../test-utils.js";
import { boundsIn, CHILD_BUTTON_LABELS, findChildButtons, findLabelledChildButtons } from "./constraint-helpers.js";

type VflContext = {
    container: Gtk.Box;
} & ChildButtons;

const SPACING = 8;
const BUTTON_GAP = 12;

const renderVflDemo = async (): Promise<VflContext> => {
    await renderDemo(constraintsVflDemo);
    const buttons = await findChildButtons();
    const container = await screen.findByName("container", { as: Gtk.Box });

    await waitFor(() => {
        expect(buttons.button3.getWidth()).toBeGreaterThan(0);
    });

    return { ...buttons, container };
};

describe("constraintsVflDemo", () => {
    it("renders the three child buttons of the VFL demo", async () => {
        await renderDemo(constraintsVflDemo);
        const buttons = await findLabelledChildButtons();
        expect(buttons.map((button) => button.getLabel())).toEqual(CHILD_BUTTON_LABELS);
    });

    it("lays out equal buttons with the declared gaps", async () => {
        const { button1, button2, button3, container } = await renderVflDemo();
        const b1 = boundsIn(button1, container);
        const b2 = boundsIn(button2, container);
        const b3 = boundsIn(button3, container);

        expect(b1.getX()).toBe(SPACING);
        expect(b1.getY()).toBe(SPACING);
        expect(b2.getY()).toBe(SPACING);
        expect(b1.getWidth()).toBe(b2.getWidth());
        expect(b2.getX() - (b1.getX() + b1.getWidth())).toBe(BUTTON_GAP);
        expect(b2.getX() + b2.getWidth()).toBe(container.getWidth() - SPACING);
        expect(b3.getY() - (b1.getY() + b1.getHeight())).toBe(BUTTON_GAP);
        expect(b3.getY() - (b2.getY() + b2.getHeight())).toBe(BUTTON_GAP);
        expect(b1.getHeight()).toBe(b3.getHeight());
        expect(b2.getHeight()).toBe(b3.getHeight());
        expect(b3.getX()).toBe(SPACING);
        expect(b3.getWidth()).toBe(container.getWidth() - SPACING * 2);
        expect(b3.getY() + b3.getHeight()).toBe(container.getHeight() - SPACING);
    });
});
