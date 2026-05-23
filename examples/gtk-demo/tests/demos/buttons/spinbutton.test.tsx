import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { spinbuttonDemo } from "../../../src/demos/buttons/spinbutton.js";
import { act, fireEvent, renderDemo, screen } from "../../test-utils.js";

describe("spinbuttonDemo", () => {
    it("exposes the expected metadata", () => {
        expect(spinbuttonDemo.id).toBe("spinbutton");
        expect(spinbuttonDemo.title).toBe("Spin Buttons");
        expect(typeof spinbuttonDemo.sourceCode).toBe("string");
    });

    it("renders the four labelled spin rows", async () => {
        await renderDemo(spinbuttonDemo);
        const spinButtons = await screen.findAllByRole(Gtk.AccessibleRole.SPIN_BUTTON);
        expect(spinButtons).toHaveLength(4);
    });

    it("formats the hex spin button as 0x00 on first render", async () => {
        await renderDemo(spinbuttonDemo);
        const hexButton = (await screen.findByName("hex_spin")) as Gtk.SpinButton;
        expect(hexButton.getText()).toBe("0x00");
    });

    it("formats the time spin button as 00:00 on first render", async () => {
        await renderDemo(spinbuttonDemo);
        const timeButton = (await screen.findByName("time_spin")) as Gtk.SpinButton;
        expect(timeButton.getText()).toBe("00:00");
    });

    it("formats the month spin button as January on first render", async () => {
        await renderDemo(spinbuttonDemo);
        const monthButton = (await screen.findByName("month_spin")) as Gtk.SpinButton;
        expect(monthButton.getText()).toBe("January");
    });
});

describe("spinbuttonDemo custom output formatting", () => {
    it("formats hex output for a non-zero value", async () => {
        await renderDemo(spinbuttonDemo);
        const hexButton = (await screen.findByName("hex_spin")) as Gtk.SpinButton;
        await act(() => hexButton.setValue(0xab));
        await fireEvent(hexButton, "value-changed");
        await fireEvent(hexButton, "output");
        expect(hexButton.getText()).toBe("0xAB");
    });

    it("formats hex output as 0x00 when the value is essentially zero", async () => {
        await renderDemo(spinbuttonDemo);
        const hexButton = (await screen.findByName("hex_spin")) as Gtk.SpinButton;
        await act(() => hexButton.setValue(0));
        await fireEvent(hexButton, "value-changed");
        await fireEvent(hexButton, "output");
        expect(hexButton.getText()).toBe("0x00");
    });

    it("formats time output as HH:MM for a non-zero value", async () => {
        await renderDemo(spinbuttonDemo);
        const timeButton = (await screen.findByName("time_spin")) as Gtk.SpinButton;
        await act(() => timeButton.setValue(150));
        await fireEvent(timeButton, "value-changed");
        await fireEvent(timeButton, "output");
        expect(timeButton.getText()).toBe("02:30");
    });

    it("formats month output for the corresponding month index", async () => {
        await renderDemo(spinbuttonDemo);
        const monthButton = (await screen.findByName("month_spin")) as Gtk.SpinButton;
        await act(() => monthButton.setValue(7));
        await fireEvent(monthButton, "value-changed");
        await fireEvent(monthButton, "output");
        expect(monthButton.getText()).toBe("July");
    });
});
