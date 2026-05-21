import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { fixedDemo } from "../../../src/demos/layout/fixed.js";
import { renderDemo } from "../../helpers/render-demo.js";
import { findAllOfType } from "../../helpers/traverse.js";

describe("fixedDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(fixedDemo.id).toBe("fixed");
        expect(fixedDemo.title).toBe("Fixed Layout / Cube");
        expect(fixedDemo.description.length).toBeGreaterThan(0);
        expect(fixedDemo.keywords).toEqual(
            expect.arrayContaining(["fixed", "GtkFixed", "GtkLayoutManager", "cube", "transform", "3D"]),
        );
        expect(typeof fixedDemo.sourceCode).toBe("string");
        expect(fixedDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(fixedDemo.defaultWidth).toBe(600);
        expect(fixedDemo.defaultHeight).toBe(400);
        expect(fixedDemo.component).toBeTypeOf("function");
    });
});

describe("fixedDemo containers", () => {
    it("renders a scrolled window wrapping the fixed containers", async () => {
        await renderDemo(fixedDemo);
        expect(await screen.findByName("scrolled")).toBeInstanceOf(Gtk.ScrolledWindow);
    });

    it("renders the outer and inner GtkFixed containers", async () => {
        await renderDemo(fixedDemo);
        expect(await screen.findByName("outer-fixed")).toBeInstanceOf(Gtk.Fixed);
        expect(await screen.findByName("inner-fixed")).toBeInstanceOf(Gtk.Fixed);
    });

    it("aligns the outer fixed container centrally and enables visible overflow", async () => {
        await renderDemo(fixedDemo);
        const outer = (await screen.findByName("outer-fixed")) as Gtk.Fixed;
        expect(outer.getHalign()).toBe(Gtk.Align.CENTER);
        expect(outer.getValign()).toBe(Gtk.Align.CENTER);
        expect(outer.getOverflow()).toBe(Gtk.Overflow.VISIBLE);
    });
});

describe("fixedDemo cube faces", () => {
    it("renders six frames, one per cube face", async () => {
        const { container } = await renderDemo(fixedDemo);
        const frames = findAllOfType(container, Gtk.Frame);
        expect(frames).toHaveLength(6);
    });

    it("sizes each cube-face frame to the FACE_SIZE constant of 200 pixels", async () => {
        const { container } = await renderDemo(fixedDemo);
        const frames = findAllOfType(container, Gtk.Frame);
        for (const frame of frames) {
            const [width, height] = frame.getSizeRequest();
            expect(width).toBe(200);
            expect(height).toBe(200);
        }
    });

    it("applies a non-null GskTransform to each cube face child of the inner fixed", async () => {
        await renderDemo(fixedDemo);
        const inner = (await screen.findByName("inner-fixed")) as Gtk.Fixed;
        const frames = findAllOfType(inner, Gtk.Frame);
        expect(frames).toHaveLength(6);
        for (const frame of frames) {
            const transform = inner.getChildTransform(frame);
            expect(transform).not.toBeNull();
        }
    });
});
