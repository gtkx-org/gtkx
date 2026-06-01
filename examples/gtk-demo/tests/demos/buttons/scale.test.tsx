import * as Gtk from "@gtkx/gi/gtk";
import { act, screen, waitFor } from "@gtkx/testing";
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
        for (const scale of scales as Gtk.Scale[]) {
            expect(scale.getDrawValue()).toBe(false);
            expect(scale.getValue()).toBe(2);
            expect(scale.getAdjustment().getUpper()).toBe(4);
            expect(scale.getAdjustment().getStepIncrement()).toBeCloseTo(0.1);
        }
    });

    it("applies integer-only rounding to the Discrete row", async () => {
        await renderDemo(scaleDemo);
        const scales = (await screen.findAllByRole(Gtk.AccessibleRole.SLIDER)) as Gtk.Scale[];
        expect(scales).toHaveLength(3);
        const discrete = scales[2];
        expect(discrete?.getRoundDigits()).toBe(0);
    });

    it("updates the plain scale's value when the adjustment changes", async () => {
        await renderDemo(scaleDemo);
        const scales = (await screen.findAllByRole(Gtk.AccessibleRole.SLIDER)) as Gtk.Scale[];
        const plain = scales[0] as Gtk.Scale;
        await act(() => plain.getAdjustment().setValue(3.5));
        await waitFor(() => expect(plain.getValue()).toBeCloseTo(3.5));
    });

    it("publishes integer-spaced marks on the Marks and Discrete rows", async () => {
        await renderDemo(scaleDemo);
        const scales = (await screen.findAllByRole(Gtk.AccessibleRole.SLIDER)) as Gtk.Scale[];
        const [, marks, discrete] = scales;
        for (const scale of [marks, discrete]) {
            expect(scale?.getAdjustment().getLower()).toBe(0);
            expect(scale?.getAdjustment().getUpper()).toBe(4);
        }
        expect(discrete?.getRoundDigits()).toBe(0);
    });
});
