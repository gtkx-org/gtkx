import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { presets, springsListDemo } from "../src/demos/springs-list.js";

const ANIMATED = { areAnimationsEnabled: true };
const SpringsList = springsListDemo.component;

const getBar = (index: number): Gtk.LevelBar =>
    screen.getByName(`springs-list-bar-${String(index)}`, { as: Gtk.LevelBar });

const getNextPreset = (): Gtk.Widget => screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Next preset" });

const expectPreset = async (preset: readonly number[]): Promise<void> => {
    await waitFor(() => {
        for (const [index, target] of preset.entries()) {
            expect(getBar(index).getValue()).toBeCloseTo(target, 2);
        }
    });
};

describe("springs-list demo", () => {
    it("animates every bar to the first preset on mount", async () => {
        await render(<SpringsList />, ANIMATED);
        expect(screen.getByText("Preset 1 of 3")).toBeVisible();
        await expectPreset(presets[0]);
    });

    it("starts all springs toward the next preset", async () => {
        await render(<SpringsList />, ANIMATED);
        await expectPreset(presets[0]);
        await userEvent.click(getNextPreset());
        expect(await screen.findByText("Preset 2 of 3")).toBeVisible();
        await expectPreset(presets[1]);
    });

    it("retargets springs still in flight when advanced again immediately", async () => {
        await render(<SpringsList />, ANIMATED);
        await userEvent.click(getNextPreset());
        await userEvent.click(getNextPreset());
        expect(await screen.findByText("Preset 3 of 3")).toBeVisible();
        await expectPreset(presets[2]);
    });

    it("wraps back to the first preset after cycling through them all", async () => {
        await render(<SpringsList />, ANIMATED);
        await userEvent.click(getNextPreset());
        await userEvent.click(getNextPreset());
        expect(await screen.findByText("Preset 3 of 3")).toBeVisible();
        await userEvent.click(getNextPreset());
        expect(await screen.findByText("Preset 1 of 3")).toBeVisible();
        await expectPreset(presets[0]);
    });
});
