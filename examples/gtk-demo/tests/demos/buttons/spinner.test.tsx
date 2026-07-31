import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { spinnerDemo } from "../../../src/demos/buttons/spinner.js";
import { renderDemo } from "../../test-utils.js";

describe("spinnerDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(spinnerDemo.id).toBe("spinner");
        expect(spinnerDemo.title).toBe("Spinner");
        expect(typeof spinnerDemo.sourceCode).toBe("string");
        expect(spinnerDemo.description.length).toBeGreaterThan(0);
        expect(spinnerDemo.keywords).toContain("gtkspinner");
        expect(spinnerDemo.resizable).toBe(false);
    });
});

describe("spinnerDemo rendering", () => {
    it("renders two GtkSpinners both initially spinning", async () => {
        await renderDemo(spinnerDemo);
        const spinners = await screen.findAllByRole(Gtk.AccessibleRole.PROGRESS_BAR, { as: Gtk.Spinner });
        expect(spinners).toHaveLength(2);
        expect(spinners.every((s) => s.getSpinning())).toBe(true);
    });

    it("renders two text entries — one in the sensitive row and one in the insensitive row", async () => {
        await renderDemo(spinnerDemo);
        const entries = await screen.findAllByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.Entry });
        expect(entries).toHaveLength(2);
    });

    it("renders the second row insensitive so its spinner and entry are effectively disabled", async () => {
        await renderDemo(spinnerDemo);
        const spinners = await screen.findAllByRole(Gtk.AccessibleRole.PROGRESS_BAR, { as: Gtk.Spinner });
        const entries = await screen.findAllByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.Entry });
        expect(spinners[0]).toBeEnabled();
        expect(entries[0]).toBeEnabled();
        expect(spinners[1]).toBeDisabled();
        expect(entries[1]).toBeDisabled();
    });

    it("accepts typed text in the sensitive-row entry", async () => {
        await renderDemo(spinnerDemo);
        const entries = await screen.findAllByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.Entry });
        const sensitiveEntry = entries[0] as Gtk.Entry;
        await userEvent.type(sensitiveEntry, "hello");
        expect(sensitiveEntry).toHaveDisplayValue("hello");
    });

    it("renders Play and Stop buttons accessible by their labels", async () => {
        await renderDemo(spinnerDemo);
        const play = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Play" });
        const stop = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Stop" });
        expect(play).toHaveAccessibleName("Play");
        expect(stop).toHaveAccessibleName("Stop");
    });
});

describe("spinnerDemo Stop / Play toggling", () => {
    it("stops the spinners when the Stop button is clicked", async () => {
        await renderDemo(spinnerDemo);
        const stop = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Stop", as: Gtk.Button });
        await userEvent.click(stop);

        await waitFor(() => {
            const spinners = screen.queryAllByRole(Gtk.AccessibleRole.PROGRESS_BAR, { as: Gtk.Spinner });
            expect(spinners.every((s) => !s.getSpinning())).toBe(true);
        });
    });

    it("restarts the spinners when the Play button is clicked after Stop", async () => {
        await renderDemo(spinnerDemo);
        const stop = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Stop", as: Gtk.Button });
        const play = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Play", as: Gtk.Button });
        await userEvent.click(stop);

        await waitFor(() => {
            const spinners = screen.queryAllByRole(Gtk.AccessibleRole.PROGRESS_BAR, { as: Gtk.Spinner });
            expect(spinners.every((s) => !s.getSpinning())).toBe(true);
        });

        await userEvent.click(play);

        await waitFor(() => {
            const spinners = screen.queryAllByRole(Gtk.AccessibleRole.PROGRESS_BAR, { as: Gtk.Spinner });
            expect(spinners.every((s) => s.getSpinning())).toBe(true);
        });
    });

    it("keeps both spinner instances flipping together across Stop and Play", async () => {
        await renderDemo(spinnerDemo);
        const spinners = await screen.findAllByRole(Gtk.AccessibleRole.PROGRESS_BAR, { as: Gtk.Spinner });
        expect(spinners.every((s) => s.getSpinning())).toBe(true);
        const stop = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Stop", as: Gtk.Button });
        const play = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Play", as: Gtk.Button });
        await userEvent.click(stop);

        await waitFor(() => {
            expect(spinners.every((s) => !s.getSpinning())).toBe(true);
        });

        await userEvent.click(play);

        await waitFor(() => {
            expect(spinners.every((s) => s.getSpinning())).toBe(true);
        });
    });
});
