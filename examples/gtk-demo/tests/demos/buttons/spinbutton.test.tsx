import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { spinbuttonDemo } from "../../../src/demos/buttons/spinbutton.js";
import { renderDemo } from "../../helpers/render-demo.js";

describe("spinbuttonDemo", () => {
    it("exposes the expected metadata", () => {
        expect(spinbuttonDemo.id).toBe("spinbutton");
        expect(spinbuttonDemo.title).toBe("Spin Buttons");
        expect(typeof spinbuttonDemo.sourceCode).toBe("string");
    });

    it("renders the four labelled spin rows", async () => {
        if (!spinbuttonDemo.component) throw new Error("spinbutton demo component missing");
        await renderDemo(spinbuttonDemo.component);
        const spinButtons = await screen.findAllByRole(Gtk.AccessibleRole.SPIN_BUTTON);
        expect(spinButtons).toHaveLength(4);
    });

    it("formats the hex spin button as 0x00 on first render", async () => {
        if (!spinbuttonDemo.component) throw new Error("spinbutton demo component missing");
        await renderDemo(spinbuttonDemo.component);
        const spinButtons = (await screen.findAllByRole(Gtk.AccessibleRole.SPIN_BUTTON)) as Gtk.SpinButton[];
        const hexButton = spinButtons[1];
        if (!hexButton) throw new Error("expected the hex spin button to be present");
        expect(hexButton.getText()).toBe("0x00");
    });

    it("formats the time spin button as 00:00 on first render", async () => {
        if (!spinbuttonDemo.component) throw new Error("spinbutton demo component missing");
        await renderDemo(spinbuttonDemo.component);
        const spinButtons = (await screen.findAllByRole(Gtk.AccessibleRole.SPIN_BUTTON)) as Gtk.SpinButton[];
        const timeButton = spinButtons[2];
        if (!timeButton) throw new Error("expected the time spin button to be present");
        expect(timeButton.getText()).toBe("00:00");
    });

    it("formats the month spin button as January on first render", async () => {
        if (!spinbuttonDemo.component) throw new Error("spinbutton demo component missing");
        await renderDemo(spinbuttonDemo.component);
        const spinButtons = (await screen.findAllByRole(Gtk.AccessibleRole.SPIN_BUTTON)) as Gtk.SpinButton[];
        const monthButton = spinButtons[3];
        if (!monthButton) throw new Error("expected the month spin button to be present");
        expect(monthButton.getText()).toBe("January");
    });
});
