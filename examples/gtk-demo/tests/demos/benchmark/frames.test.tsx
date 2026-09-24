import * as Gtk from "@gtkx/gi/gtk";
import { screen, screenshot, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { framesDemo } from "../../../src/demos/benchmark/frames.js";
import { renderDemo } from "../../test-utils.js";

const FPS_PATTERN = /^\d+\.\d{2} fps$/;

const findFpsLabel = (header: Gtk.HeaderBar): Gtk.Label =>
    within(header).getByRole(Gtk.AccessibleRole.STATUS, { name: FPS_PATTERN, as: Gtk.Label });

const findFramesHeader = async (): Promise<Gtk.HeaderBar> => {
    await renderDemo(framesDemo);

    return screen.findByName("frames-header", { as: Gtk.HeaderBar });
};

vi.setConfig({ testTimeout: 30_000 });

describe("framesDemo header bar", () => {
    it("renders the fps label in the header bar driven by shared state", async () => {
        const header = await findFramesHeader();
        const fpsLabel = await within(header).findByRole(Gtk.AccessibleRole.STATUS, { name: FPS_PATTERN });
        expect(header).toContainElement(fpsLabel);
        expect(fpsLabel).toHaveTextContent("0.00 fps");
    });
});

describe("framesDemo color widget", () => {
    it("fills its parent and paints changing color frames", async () => {
        await renderDemo(framesDemo);
        const colorWidget = await screen.findByRole(Gtk.AccessibleRole.IMG, { name: "Changing color" });
        const box = colorWidget.getParent() as Gtk.Box;
        expect(box).toBeInstanceOf(Gtk.Box);
        expect(colorWidget.getWidth()).toBeGreaterThan(0);
        expect(colorWidget.getHeight()).toBeGreaterThan(0);
        expect(colorWidget.getWidth()).toBe(box.getWidth());
        expect(colorWidget.getHeight()).toBe(box.getHeight());
        const firstFrame = await screenshot(colorWidget);

        await waitFor(async () => {
            const nextFrame = await screenshot(colorWidget);
            expect(nextFrame.data).not.toBe(firstFrame.data);
        });
    });
});

describe("framesDemo fps polling", () => {
    it("drives the fps poller off the frame clock so the header label leaves 0.00 fps", async () => {
        await renderDemo(framesDemo);
        const colorWidget = await screen.findByRole(Gtk.AccessibleRole.IMG, { name: "Changing color" });
        expect(colorWidget.getFrameClock()).not.toBeNull();
        const header = await screen.findByName("frames-header", { as: Gtk.HeaderBar });
        expect(findFpsLabel(header)).toHaveTextContent("0.00 fps");

        await waitFor(
            () => {
                expect(findFpsLabel(header)).not.toHaveTextContent("0.00 fps");
            },
            { timeout: 10_000 },
        );

        expect(findFpsLabel(header).getLabel()).toMatch(FPS_PATTERN);
    });
});

describe("framesDemo window", () => {
    it("realizes the host window at the demo's 600x400 default size", async () => {
        await renderDemo(framesDemo);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
        expect(window.getWidth()).toBe(600);
        expect(window.getHeight()).toBe(400);
    });
});
