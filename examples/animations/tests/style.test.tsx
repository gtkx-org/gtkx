import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { styleDemo } from "../src/demos/style.js";

const ANIMATED = { areAnimationsEnabled: true };
const SETTLE = { timeout: 3000 };
const StyleComponent = styleDemo.component;

const findHeading = (): Promise<Gtk.Label> => screen.findByName("style-heading", { as: Gtk.Label });
const findToggle = (): Promise<Gtk.ToggleButton> => screen.findByName("style-toggle", { as: Gtk.ToggleButton });

const expectTint = (label: Gtk.Label, red: number): Promise<void> =>
    waitFor(() => {
        expect(label.getColor().red).toBeCloseTo(red, 1);
    }, SETTLE);

describe("style demo", () => {
    it("settles the card and its labels at the calm palette", async () => {
        await render(<StyleComponent />, ANIMATED);
        const heading = await findHeading();
        await expectTint(heading, 46 / 255);
        expect(await screen.findByText("Deploy finished")).toBeVisible();
    });

    it("animates the text color to the alert palette and back", async () => {
        await render(<StyleComponent />, ANIMATED);
        const heading = await findHeading();
        await expectTint(heading, 46 / 255);
        await userEvent.click(await findToggle());
        await expectTint(heading, 1);
        await userEvent.click(await findToggle());
        await expectTint(heading, 46 / 255);
    });

    it("settles back at the calm palette when the toggle is flipped twice in a row", async () => {
        await render(<StyleComponent />, ANIMATED);
        const heading = await findHeading();
        await expectTint(heading, 46 / 255);
        const toggle = await findToggle();
        await userEvent.click(toggle);
        await userEvent.click(toggle);
        expect(toggle.getActive()).toBe(false);
        await expectTint(heading, 46 / 255);
    });
});
