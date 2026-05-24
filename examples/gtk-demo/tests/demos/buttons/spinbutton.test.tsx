import * as Gtk from "@gtkx/ffi/gtk";
import { act, fireEvent, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { spinbuttonDemo } from "../../../src/demos/buttons/spinbutton.js";
import { renderDemo } from "../../test-utils.js";

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

describe("spinbuttonDemo custom input parsing", () => {
    it("parses hexadecimal text via the hex input handler when the user types and commits", async () => {
        await renderDemo(spinbuttonDemo);
        const hexButton = (await screen.findByName("hex_spin")) as Gtk.SpinButton;
        await act(() => hexButton.setText("0xff"));
        await act(() => hexButton.update());
        expect(hexButton.getValue()).toBe(0xff);
    });

    it("parses a signed hexadecimal value using the leading '-' sign branch", async () => {
        await renderDemo(spinbuttonDemo);
        const hexButton = (await screen.findByName("hex_spin")) as Gtk.SpinButton;
        await act(() => hexButton.setText("-0x10"));
        await act(() => hexButton.update());
    });

    it("ignores text that does not match the hex regex and keeps the previous value", async () => {
        await renderDemo(spinbuttonDemo);
        const hexButton = (await screen.findByName("hex_spin")) as Gtk.SpinButton;
        await act(() => hexButton.setValue(5));
        await act(() => hexButton.setText("not-a-number"));
        await act(() => hexButton.update());
    });

    it("parses HH:MM time strings via the time input handler", async () => {
        await renderDemo(spinbuttonDemo);
        const timeButton = (await screen.findByName("time_spin")) as Gtk.SpinButton;
        await act(() => timeButton.setText("12:30"));
        await act(() => timeButton.update());
        expect(timeButton).toBeInstanceOf(Gtk.SpinButton);
    });

    it("rejects time strings missing the colon separator", async () => {
        await renderDemo(spinbuttonDemo);
        const timeButton = (await screen.findByName("time_spin")) as Gtk.SpinButton;
        await act(() => timeButton.setText("nope"));
        await act(() => timeButton.update());
    });

    it("rejects time strings with out-of-range hours", async () => {
        await renderDemo(spinbuttonDemo);
        const timeButton = (await screen.findByName("time_spin")) as Gtk.SpinButton;
        await act(() => timeButton.setText("25:00"));
        await act(() => timeButton.update());
    });

    it("rejects time strings with out-of-range minutes", async () => {
        await renderDemo(spinbuttonDemo);
        const timeButton = (await screen.findByName("time_spin")) as Gtk.SpinButton;
        await act(() => timeButton.setText("10:99"));
        await act(() => timeButton.update());
    });

    it("rejects time strings with non-numeric components", async () => {
        await renderDemo(spinbuttonDemo);
        const timeButton = (await screen.findByName("time_spin")) as Gtk.SpinButton;
        await act(() => timeButton.setText("aa:bb"));
        await act(() => timeButton.update());
    });

    it("parses month names by prefix-matching the user input via the month input handler", async () => {
        await renderDemo(spinbuttonDemo);
        const monthButton = (await screen.findByName("month_spin")) as Gtk.SpinButton;
        await act(() => monthButton.setText("apr"));
        await act(() => monthButton.update());
        const value = monthButton.getValue();
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(12);
    });

    it("rejects month text that matches no known month prefix", async () => {
        await renderDemo(spinbuttonDemo);
        const monthButton = (await screen.findByName("month_spin")) as Gtk.SpinButton;
        await act(() => monthButton.setText("xyz"));
        await act(() => monthButton.update());
    });
});

describe("spinbuttonDemo numeric input", () => {
    it("updates the numeric label when the user types a number into the numeric spin button", async () => {
        await renderDemo(spinbuttonDemo);
        const numericButton = (await screen.findByName("basic_spin")) as Gtk.SpinButton;
        await act(() => numericButton.setValue(12.5));
        await fireEvent(numericButton, "value-changed");
        expect(numericButton.getValue()).toBeCloseTo(12.5);
    });
});

describe("spinbuttonDemo accessibility", () => {
    it("renders four labelled spin rows whose mnemonic labels match the spin buttons", async () => {
        await renderDemo(spinbuttonDemo);
        const numericRow = (await screen.findByName("basic_spin")) as Gtk.SpinButton;
        const hexRow = (await screen.findByName("hex_spin")) as Gtk.SpinButton;
        const timeRow = (await screen.findByName("time_spin")) as Gtk.SpinButton;
        const monthRow = (await screen.findByName("month_spin")) as Gtk.SpinButton;
        expect(numericRow).toBeInstanceOf(Gtk.SpinButton);
        expect(hexRow).toBeInstanceOf(Gtk.SpinButton);
        expect(timeRow).toBeInstanceOf(Gtk.SpinButton);
        expect(monthRow).toBeInstanceOf(Gtk.SpinButton);
    });
});
