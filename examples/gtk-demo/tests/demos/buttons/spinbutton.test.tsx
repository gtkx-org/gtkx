import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { spinbuttonDemo } from "../../../src/demos/buttons/spinbutton.js";
import { renderDemo } from "../../test-utils.js";

const TIME_DISPLAY_PATTERN = /^\d{2}:\d{2}$/;

const FIRST_RENDER_FORMATS = [
    { field: "hex", displayValue: "0x00" },
    { field: "time", displayValue: "00:00" },
    { field: "month", displayValue: "January" },
];

const REJECTED_TIME_TEXTS = [
    { label: "missing the colon separator", text: "nope" },
    { label: "with out-of-range hours", text: "25:00" },
    { label: "with out-of-range minutes", text: "10:99" },
    { label: "with non-numeric components", text: "aa:bb" },
];

const establishTimeValue = async (timeButton: Gtk.SpinButton): Promise<void> => {
    await userEvent.clear(timeButton);
    await userEvent.type(timeButton, "12:30");
    await userEvent.keyboard(timeButton, "{Enter}");

    await waitFor(() => {
        expect(timeButton.getValue()).toBe(750);
    });
};

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

    it.each(FIRST_RENDER_FORMATS)(
        "formats the $field spin button as $displayValue on first render",
        async ({ displayValue }) => {
            await renderDemo(spinbuttonDemo);
            expect(await screen.findByDisplayValue(displayValue)).toBeTruthy();
        },
    );
});

describe("spinbuttonDemo custom output formatting", () => {
    it("formats hex output for a non-zero value", async () => {
        await renderDemo(spinbuttonDemo);
        const hexButton = (await screen.findByName("hex_spin")) as Gtk.SpinButton;
        await userEvent.clear(hexButton);
        await userEvent.type(hexButton, "0xAB");
        await userEvent.keyboard(hexButton, "{Enter}");
        expect(await screen.findByDisplayValue("0xAB")).toBeTruthy();
    });

    it("formats hex output as 0x00 when the value is essentially zero", async () => {
        await renderDemo(spinbuttonDemo);
        const hexButton = (await screen.findByName("hex_spin")) as Gtk.SpinButton;
        await userEvent.clear(hexButton);
        await userEvent.type(hexButton, "0");
        await userEvent.keyboard(hexButton, "{Enter}");
        expect(await screen.findByDisplayValue("0x00")).toBeTruthy();
    });

    it("formats time output as HH:MM for a non-zero value", async () => {
        await renderDemo(spinbuttonDemo);
        const timeButton = (await screen.findByName("time_spin")) as Gtk.SpinButton;
        await userEvent.clear(timeButton);
        await userEvent.type(timeButton, "02:30");
        await userEvent.keyboard(timeButton, "{Enter}");
        expect(await screen.findByDisplayValue("02:30")).toBeTruthy();
    });

    it("formats month output for the corresponding month index", async () => {
        await renderDemo(spinbuttonDemo);
        const monthButton = (await screen.findByName("month_spin")) as Gtk.SpinButton;
        await userEvent.clear(monthButton);
        await userEvent.type(monthButton, "July");
        await userEvent.keyboard(monthButton, "{Enter}");
        expect(await screen.findByDisplayValue("July")).toBeTruthy();
    });
});

describe("spinbuttonDemo custom input parsing", () => {
    it("parses hexadecimal text via the hex input handler when the user types and commits", async () => {
        await renderDemo(spinbuttonDemo);
        const hexButton = (await screen.findByName("hex_spin")) as Gtk.SpinButton;
        await userEvent.clear(hexButton);
        await userEvent.type(hexButton, "0xff");
        await userEvent.keyboard(hexButton, "{Enter}");
        expect(screen.getByRole(Gtk.AccessibleRole.SPIN_BUTTON, { value: { now: 0xFF } })).toBeTruthy();
    });

    it("clamps a signed hexadecimal value to the adjustment lower bound via the '-' sign branch", async () => {
        await renderDemo(spinbuttonDemo);
        const hexButton = (await screen.findByName("hex_spin")) as Gtk.SpinButton;
        await userEvent.clear(hexButton);
        await userEvent.type(hexButton, "0x20");
        await userEvent.keyboard(hexButton, "{Enter}");

        await waitFor(() => {
            expect(hexButton.getValue()).toBe(0x20);
        });

        await userEvent.clear(hexButton);
        await userEvent.type(hexButton, "-0x10");
        await userEvent.keyboard(hexButton, "{Enter}");

        await waitFor(() => {
            expect(hexButton.getValue()).toBe(0);
        });

        expect(await screen.findByDisplayValue("0x00")).toBe(hexButton);
    });

    it("rejects text that does not match the hex regex instead of committing it verbatim", async () => {
        await renderDemo(spinbuttonDemo);
        const hexButton = (await screen.findByName("hex_spin")) as Gtk.SpinButton;
        await userEvent.clear(hexButton);
        await userEvent.type(hexButton, "0x05");
        await userEvent.keyboard(hexButton, "{Enter}");

        await waitFor(() => {
            expect(hexButton.getValue()).toBe(5);
        });

        await userEvent.clear(hexButton);
        await userEvent.type(hexButton, "not-a-number");
        await userEvent.keyboard(hexButton, "{Enter}");

        await waitFor(() => {
            expect(hexButton.getText()).toMatch(/^0x[0-9A-Fa-f]{2}$/);
        });

        expect(hexButton.getText()).not.toBe("not-a-number");
    });
});

describe("spinbuttonDemo time input parsing", () => {
    it("parses HH:MM time strings via the time input handler", async () => {
        await renderDemo(spinbuttonDemo);
        const timeButton = (await screen.findByName("time_spin")) as Gtk.SpinButton;
        await userEvent.clear(timeButton);
        await userEvent.type(timeButton, "12:30");
        await userEvent.keyboard(timeButton, "{Enter}");
        expect(screen.getByRole(Gtk.AccessibleRole.SPIN_BUTTON, { value: { now: 750 } })).toBeTruthy();
    });

    it.each(REJECTED_TIME_TEXTS)("rejects time strings $label and keeps the previous value", async ({ text }) => {
        await renderDemo(spinbuttonDemo);
        const timeButton = (await screen.findByName("time_spin")) as Gtk.SpinButton;
        await establishTimeValue(timeButton);
        await userEvent.clear(timeButton);
        await userEvent.type(timeButton, text);
        await userEvent.keyboard(timeButton, "{Enter}");

        await waitFor(() => {
            expect(timeButton.getText()).toMatch(TIME_DISPLAY_PATTERN);
        });

        expect(timeButton.getText()).not.toBe(text);
    });
});

describe("spinbuttonDemo month input parsing", () => {
    it("parses month names by prefix-matching the user input via the month input handler", async () => {
        await renderDemo(spinbuttonDemo);
        const monthButton = (await screen.findByName("month_spin")) as Gtk.SpinButton;
        await userEvent.clear(monthButton);
        await userEvent.type(monthButton, "apr");
        await userEvent.keyboard(monthButton, "{Enter}");

        await waitFor(() => {
            expect(monthButton.getValue()).toBe(4);
        });

        expect(await screen.findByDisplayValue("April")).toBe(monthButton);
    });

    it("rejects month text that matches no known month prefix and keeps the previous value", async () => {
        await renderDemo(spinbuttonDemo);
        const monthButton = (await screen.findByName("month_spin")) as Gtk.SpinButton;
        await userEvent.clear(monthButton);
        await userEvent.type(monthButton, "apr");
        await userEvent.keyboard(monthButton, "{Enter}");

        await waitFor(() => {
            expect(monthButton.getValue()).toBe(4);
        });

        await userEvent.clear(monthButton);
        await userEvent.type(monthButton, "xyz");
        await userEvent.keyboard(monthButton, "{Enter}");
        expect(monthButton.getValue()).toBe(4);
    });
});

describe("spinbuttonDemo numeric input", () => {
    it("updates the numeric spin value and its mirrored label when the user types a number", async () => {
        await renderDemo(spinbuttonDemo);
        const numericButton = (await screen.findByName("basic_spin")) as Gtk.SpinButton;
        await userEvent.clear(numericButton);
        await userEvent.type(numericButton, "12.5");
        await userEvent.keyboard(numericButton, "{Enter}");
        expect(screen.getByRole(Gtk.AccessibleRole.SPIN_BUTTON, { value: { now: 12.5 } })).toBe(numericButton);
        expect(await screen.findByText("12.5")).toBeInstanceOf(Gtk.Label);
    });

    it("steps the numeric value up by its 0.5 step increment when ArrowUp is pressed", async () => {
        await renderDemo(spinbuttonDemo);
        const numericButton = (await screen.findByName("basic_spin")) as Gtk.SpinButton;
        numericButton.grabFocus();
        await userEvent.keyboard(numericButton, "{ArrowUp}");

        await waitFor(() => {
            expect(numericButton.getValue()).toBeCloseTo(0.5);
        });

        expect(await screen.findByText("0.5")).toBeInstanceOf(Gtk.Label);
    });
});

describe("spinbuttonDemo mirrored value labels", () => {
    it("mirrors the parsed hex value into the third-column label", async () => {
        await renderDemo(spinbuttonDemo);
        const hexButton = (await screen.findByName("hex_spin")) as Gtk.SpinButton;
        await userEvent.clear(hexButton);
        await userEvent.type(hexButton, "0xff");
        await userEvent.keyboard(hexButton, "{Enter}");

        await waitFor(() => {
            expect(hexButton.getValue()).toBe(255);
        });

        expect(await screen.findByText("255")).toBeInstanceOf(Gtk.Label);
    });

    it("mirrors the parsed time value (minutes since midnight) into the third-column label", async () => {
        await renderDemo(spinbuttonDemo);
        const timeButton = (await screen.findByName("time_spin")) as Gtk.SpinButton;
        await establishTimeValue(timeButton);
        expect(await screen.findByText("750")).toBeInstanceOf(Gtk.Label);
    });

    it("mirrors the parsed month index into the third-column label", async () => {
        await renderDemo(spinbuttonDemo);
        const monthButton = (await screen.findByName("month_spin")) as Gtk.SpinButton;
        await userEvent.clear(monthButton);
        await userEvent.type(monthButton, "July");
        await userEvent.keyboard(monthButton, "{Enter}");

        await waitFor(() => {
            expect(monthButton.getValue()).toBe(7);
        });

        expect(await screen.findByText("7")).toBeInstanceOf(Gtk.Label);
    });
});

describe("spinbuttonDemo wrap behavior", () => {
    it("wraps the hex value to the upper bound when stepped down past zero", async () => {
        await renderDemo(spinbuttonDemo);
        const hexButton = (await screen.findByName("hex_spin")) as Gtk.SpinButton;
        expect(hexButton.getValue()).toBe(0);
        hexButton.grabFocus();
        await userEvent.keyboard(hexButton, "{ArrowDown}");

        await waitFor(() => {
            expect(hexButton.getValue()).toBe(255);
        });

        expect(await screen.findByDisplayValue("0xFF")).toBe(hexButton);
    });
});

describe("spinbuttonDemo accessibility", () => {
    it("renders four labelled spin rows whose mnemonic labels match the spin buttons", async () => {
        await renderDemo(spinbuttonDemo);
        expect(screen.getByLabelText(/Numeric/)).toBe(await screen.findByName("basic_spin"));
        expect(screen.getByLabelText(/Hexadecimal/)).toBe(await screen.findByName("hex_spin"));
        expect(screen.getByLabelText(/Time/)).toBe(await screen.findByName("time_spin"));
        expect(screen.getByLabelText(/Month/)).toBe(await screen.findByName("month_spin"));
    });
});
