import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { overlayDemo } from "../../../src/demos/layout/overlay.js";
import { renderDemo } from "../../test-utils.js";

describe("overlayDemo grid and labels", () => {
    it("renders a 5x5 grid of numbered buttons", async () => {
        await renderDemo(overlayDemo);
        const grid = await screen.findByName("number-grid", { as: Gtk.Grid });
        const buttons = within(grid).getAllByRole(Gtk.AccessibleRole.BUTTON, { as: Gtk.Button });

        expect(buttons.map((button) => button.getLabel())).toEqual(
            Array.from({ length: 25 }, (_unused, index) => String(index)),
        );
    });

    it("renders the decorative 'Numbers' label as non-interactive markup inside a click-through box", async () => {
        await renderDemo(overlayDemo);
        const numbersLabel = await screen.findByName("numbers-label", { as: Gtk.Label });
        expect(numbersLabel).toHaveObjectProperty("useMarkup", true);
        expect(numbersLabel).toHaveTextContent("Numbers");
        expect(numbersLabel).toHaveObjectProperty("canTarget", false);
        const box = numbersLabel.getParent();
        expect(box).toBeInstanceOf(Gtk.Box);
        expect(box).toHaveObjectProperty("canTarget", false);
    });
});

describe("overlayDemo entry behavior", () => {
    it("renders the entry with the placeholder text 'Your Lucky Number' and empty initial value", async () => {
        await renderDemo(overlayDemo);
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.Entry });
        expect(screen.getByPlaceholderText("Your Lucky Number")).toBe(entry);
        expect(entry).toHaveDisplayValue("");
    });

    it("updates the entry to the clicked number when a grid button is activated", async () => {
        await renderDemo(overlayDemo);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "13" });
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.Entry });
        await userEvent.click(button);

        await waitFor(() => {
            expect(entry).toHaveDisplayValue("13");
        });
    });

    it("propagates user-typed text into the entry", async () => {
        await renderDemo(overlayDemo);
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.Entry });
        await userEvent.type(entry, "typed");
        expect(entry).toHaveDisplayValue("typed");
    });
});
