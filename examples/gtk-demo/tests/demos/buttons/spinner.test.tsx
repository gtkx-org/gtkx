import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { spinnerDemo } from "../../../src/demos/buttons/spinner.js";
import { findButton, renderDemo } from "../../test-utils.js";

const renderSpinners = async (): Promise<Gtk.Spinner[]> => {
    await renderDemo(spinnerDemo);

    return await screen.findAllByRole(Gtk.AccessibleRole.PROGRESS_BAR, { as: Gtk.Spinner });
};

const findEntries = async (): Promise<Gtk.Entry[]> =>
    await screen.findAllByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.Entry });

const expectSpinning = async (areSpinning: boolean): Promise<void> => {
    await waitFor(() => {
        const spinners = screen.queryAllByRole(Gtk.AccessibleRole.PROGRESS_BAR, { as: Gtk.Spinner });
        expect(spinners.every((s) => s.getSpinning() === areSpinning)).toBe(true);
    });
};

describe("spinnerDemo rendering", () => {
    it("renders two GtkSpinners both initially spinning", async () => {
        const spinners = await renderSpinners();
        expect(spinners).toHaveLength(2);
        expect(spinners.every((s) => s.getSpinning())).toBe(true);
    });

    it("renders two text entries — one in the sensitive row and one in the insensitive row", async () => {
        await renderDemo(spinnerDemo);
        const entries = await findEntries();
        expect(entries).toHaveLength(2);
    });

    it("renders the second row insensitive so its spinner and entry are effectively disabled", async () => {
        const spinners = await renderSpinners();
        const entries = await findEntries();
        expect(spinners[0]).toBeEnabled();
        expect(entries[0]).toBeEnabled();
        expect(spinners[1]).toBeDisabled();
        expect(entries[1]).toBeDisabled();
    });

    it("accepts typed text in the sensitive-row entry", async () => {
        await renderDemo(spinnerDemo);
        const entries = await findEntries();
        const sensitiveEntry = entries[0] as Gtk.Entry;
        await userEvent.type(sensitiveEntry, "hello");
        expect(sensitiveEntry).toHaveDisplayValue("hello");
    });

    it("renders Play and Stop buttons accessible by their labels", async () => {
        await renderDemo(spinnerDemo);
        const play = await findButton("Play");
        const stop = await findButton("Stop");
        expect(play).toHaveAccessibleName("Play");
        expect(stop).toHaveAccessibleName("Stop");
    });
});

describe("spinnerDemo Stop / Play toggling", () => {
    it("stops the spinners when the Stop button is clicked", async () => {
        await renderDemo(spinnerDemo);
        const stop = await findButton("Stop");
        await userEvent.click(stop);
        await expectSpinning(false);
    });

    it("restarts the spinners when the Play button is clicked after Stop", async () => {
        await renderDemo(spinnerDemo);
        const stop = await findButton("Stop");
        const play = await findButton("Play");
        await userEvent.click(stop);
        await expectSpinning(false);
        await userEvent.click(play);
        await expectSpinning(true);
    });

    it("keeps both spinner instances flipping together across Stop and Play", async () => {
        const spinners = await renderSpinners();
        expect(spinners.every((s) => s.getSpinning())).toBe(true);
        const stop = await findButton("Stop");
        const play = await findButton("Play");
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
