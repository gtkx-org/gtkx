import * as Gtk from "@gtkx/gi/gtk";
import { act, render, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { reducedMotionDemo } from "../src/demos/reduced-motion.js";

const { component: ReducedMotionDemo } = reducedMotionDemo;
const ANIMATED = { areAnimationsEnabled: true };
const HAS_REDUCED_MOTION_SETTING = Gtk.checkVersion(4, 22, 0) === null;

const findSlider = (): Promise<Gtk.Label> => screen.findByName("reduced-motion-slider", { as: Gtk.Label });

const clickButton = async (name: string): Promise<void> => {
    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name }));
};

const expectMarginStart = (slider: Gtk.Label, value: number): Promise<void> =>
    waitFor(() => {
        expect(slider).toHaveObjectProperty("marginStart", value);
    });

const recordMarginWrites = (slider: Gtk.Label): number[] => {
    const seen: number[] = [];

    slider.on("notify::margin-start", () => {
        seen.push(slider.getMarginStart());
    });

    return seen;
};

const getSettings = (): Gtk.Settings => {
    const settings = Gtk.Settings.getDefault();

    if (settings === null) {
        throw new Error("expected a default display");
    }

    return settings;
};

const setAnimationsEnabled = (isEnabled: boolean): PromiseLike<void> =>
    act(() => {
        getSettings().gtkEnableAnimations = isEnabled;
    });

const setReducedMotion = (motion: Gtk.ReducedMotion): PromiseLike<void> =>
    act(() => {
        getSettings().gtkInterfaceReducedMotion = motion;
    });

describe("reduced motion demo", () => {
    it("reports that motion is not reduced and slides to the target", async () => {
        await render(<ReducedMotionDemo />, ANIMATED);
        expect(await screen.findByText("Reduced motion: off")).toBeVisible();
        const slider = await findSlider();
        await clickButton("Slide away");
        await expectMarginStart(slider, 200);
    });

    it("slides back to the start when re-triggered mid-flight", async () => {
        await render(<ReducedMotionDemo />, ANIMATED);
        const slider = await findSlider();
        await clickButton("Slide away");

        await waitFor(() => {
            expect(slider.marginStart).toBeGreaterThan(0);
        });

        await clickButton("Slide back");
        await expectMarginStart(slider, 0);
    });

    it.skipIf(!HAS_REDUCED_MOTION_SETTING)("honors the reduce-motion preference", async () => {
        await setReducedMotion(Gtk.ReducedMotion.REDUCE);

        try {
            await render(<ReducedMotionDemo />, ANIMATED);
            expect(await screen.findByText("Reduced motion: on")).toBeVisible();
            const slider = await findSlider();
            const seen = recordMarginWrites(slider);
            await clickButton("Slide away");
            await expectMarginStart(slider, 200);
            expect(seen.length).toBeGreaterThan(0);

            for (const value of seen) {
                expect(value).toBe(200);
            }
        } finally {
            await setReducedMotion(Gtk.ReducedMotion.NO_PREFERENCE);
        }
    });

    it("follows the desktop setting while mounted", async () => {
        await render(<ReducedMotionDemo />, ANIMATED);
        expect(await screen.findByText("Reduced motion: off")).toBeVisible();

        try {
            await setAnimationsEnabled(false);
            expect(await screen.findByText("Reduced motion: on")).toBeVisible();
            const slider = await findSlider();
            await clickButton("Slide away");
            await expectMarginStart(slider, 200);
        } finally {
            await setAnimationsEnabled(true);
        }
    });
});
