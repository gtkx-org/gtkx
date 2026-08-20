import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { trailDemo } from "../src/demos/trail.js";

const ANIMATED = { areAnimationsEnabled: true };
const Trail = trailDemo.component;
const items = ["Alpha", "Beta", "Gamma", "Delta"];

const getToggle = (): Gtk.ToggleButton => screen.getByName("trail-toggle", { as: Gtk.ToggleButton });

const expectTrailSettled = async (opacity: number, marginStart: number): Promise<void> => {
    await waitFor(() => {
        for (const item of items) {
            const label = screen.getByText(item);
            expect(label.getOpacity()).toBeCloseTo(opacity, 2);
            expect(label).toHaveObjectProperty("marginStart", marginStart);
        }
    });
};

describe("trail demo", () => {
    it("trails every label in on mount", async () => {
        await render(<Trail />, ANIMATED);
        await expectTrailSettled(1, 0);
    });

    it("trails the labels out when toggled off", async () => {
        await render(<Trail />, ANIMATED);
        await expectTrailSettled(1, 0);
        await userEvent.click(getToggle());

        await waitFor(() => {
            expect(getToggle()).toHaveObjectProperty("active", false);
        });

        await expectTrailSettled(0, 48);
    });

    it("returns the labels to the shown state when toggled back mid-flight", async () => {
        await render(<Trail />, ANIMATED);
        await expectTrailSettled(1, 0);
        await userEvent.click(getToggle());

        await waitFor(() => {
            const margin = screen.getByText("Alpha").getMarginStart();
            expect(margin).toBeGreaterThan(0);
            expect(margin).toBeLessThan(48);
        });

        await userEvent.click(getToggle());

        await waitFor(() => {
            expect(getToggle()).toHaveObjectProperty("active", true);
        });

        await expectTrailSettled(1, 0);
    });

    it("settles back in after a full out-and-in round trip", async () => {
        await render(<Trail />, ANIMATED);
        await expectTrailSettled(1, 0);
        await userEvent.click(getToggle());
        await expectTrailSettled(0, 48);
        await userEvent.click(getToggle());
        await expectTrailSettled(1, 0);
    });
});
