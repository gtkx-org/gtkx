import * as Gtk from "@gtkx/gi/gtk";
import { act, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { scaleDemo } from "../../../src/demos/buttons/scale.js";
import { renderDemo } from "../../test-utils.js";

describe("scaleDemo", () => {
    it("exposes the expected metadata", () => {
        expect(scaleDemo.id).toBe("scale");
        expect(scaleDemo.title).toBe("Scales");
        expect(scaleDemo.description.length).toBeGreaterThan(0);
        expect(typeof scaleDemo.sourceCode).toBe("string");
        expect(scaleDemo.resizable).toBe(false);
    });

    it("renders three labelled scale rows configured with the demo defaults", async () => {
        await renderDemo(scaleDemo);
        await screen.findByText("Plain", { exact: false });
        await screen.findByText("Marks", { exact: false });
        await screen.findByText("Discrete", { exact: false });
        const scales = await screen.findAllByRole(Gtk.AccessibleRole.SLIDER);
        expect(scales).toHaveLength(3);
        expect(screen.getAllByRole(Gtk.AccessibleRole.SLIDER, { value: { now: 2, max: 4 } })).toHaveLength(3);
        for (const scale of scales as Gtk.Scale[]) {
            expect(scale.getDrawValue()).toBe(false);
            expect(scale.getAdjustment().getStepIncrement()).toBeCloseTo(0.1);
        }
    });

    it("snaps a fractional interactive change to the nearest integer on the Discrete row", async () => {
        await renderDemo(scaleDemo);
        const scales = (await screen.findAllByRole(Gtk.AccessibleRole.SLIDER)) as Gtk.Scale[];
        const discrete = scales[2] as Gtk.Scale;
        await userEvent.slide(discrete, 3.4);
        await waitFor(() => expect(discrete.getValue()).toBe(3));
    });

    it("leaves a fractional interactive change unrounded on the continuous Plain row", async () => {
        await renderDemo(scaleDemo);
        const scales = (await screen.findAllByRole(Gtk.AccessibleRole.SLIDER)) as Gtk.Scale[];
        const plain = scales[0] as Gtk.Scale;
        await userEvent.slide(plain, 3.4);
        await waitFor(() => expect(plain.getValue()).toBeCloseTo(3.4));
    });

    it("updates the plain scale's value when the adjustment changes", async () => {
        await renderDemo(scaleDemo);
        const scales = (await screen.findAllByRole(Gtk.AccessibleRole.SLIDER)) as Gtk.Scale[];
        const plain = scales[0] as Gtk.Scale;
        await act(() => plain.getAdjustment().setValue(3.5));
        await waitFor(() => expect(screen.getByRole(Gtk.AccessibleRole.SLIDER, { value: { now: 3.5 } })).toBe(plain));
    });

    it("updates the Marks scale value when it is moved interactively", async () => {
        await renderDemo(scaleDemo);
        const scales = (await screen.findAllByRole(Gtk.AccessibleRole.SLIDER)) as Gtk.Scale[];
        const marks = scales[1] as Gtk.Scale;
        await userEvent.slide(marks, 1.5);
        await waitFor(() => expect(marks.getValue()).toBeCloseTo(1.5));
    });
});
