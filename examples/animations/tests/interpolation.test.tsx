import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { interpolationDemo } from "../src/demos/interpolation.js";

const ANIMATED = { areAnimationsEnabled: true };
const InterpolationDemo = interpolationDemo.component;

const findProgress = (): Promise<Gtk.ProgressBar> =>
    screen.findByName("interpolation-progress", { as: Gtk.ProgressBar });

const findBar = (): Promise<Gtk.Box> => screen.findByName("interpolation-bar", { as: Gtk.Box });
const findReplay = (): Promise<Gtk.Widget> => screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Replay" });

const expectSettled = async (progress: Gtk.ProgressBar, bar: Gtk.Box): Promise<void> => {
    await waitFor(() => {
        expect(progress).toHaveObjectProperty("fraction", 1);
        expect(bar).toHaveObjectProperty("widthRequest", 240);
    });
};

const expectInFlight = (progress: Gtk.ProgressBar): Promise<void> =>
    waitFor(() => {
        const fraction = progress.getFraction();
        expect(fraction).toBeGreaterThan(0);
        expect(fraction).toBeLessThan(1);
    });

describe("interpolation demo", () => {
    it("drives every derived output from one spring to its settled targets", async () => {
        await render(<InterpolationDemo />, ANIMATED);
        const progress = await findProgress();
        const bar = await findBar();
        await expectSettled(progress, bar);
        expect(await screen.findByText("100 items")).toBeVisible();
        expect(await screen.findByText("100 + 20 bonus")).toBeVisible();
    });

    it("replays the animation from the start after it has settled", async () => {
        await render(<InterpolationDemo />, ANIMATED);
        const progress = await findProgress();
        const bar = await findBar();
        await expectSettled(progress, bar);
        await userEvent.click(await findReplay());
        await expectInFlight(progress);
        await expectSettled(progress, bar);
        expect(await screen.findByText("100 items")).toBeVisible();
    });

    it("settles at the targets when replayed while still in flight", async () => {
        await render(<InterpolationDemo />, ANIMATED);
        const progress = await findProgress();
        const bar = await findBar();
        await userEvent.click(await findReplay());
        await expectInFlight(progress);
        await userEvent.click(await findReplay());
        await expectSettled(progress, bar);
        expect(await screen.findByText("100 + 20 bonus")).toBeVisible();
    });
});
