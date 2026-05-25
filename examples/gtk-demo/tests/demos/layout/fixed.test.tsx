import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { fixedDemo } from "../../../src/demos/layout/fixed.js";
import { renderDemo } from "../../test-utils.js";

const FACE_NAMES = ["back", "left", "bottom", "right", "top", "front"] as const;
const FACE_SIZE = 200;

const findCubeFaces = async (): Promise<Gtk.Frame[]> => {
    const faces: Gtk.Frame[] = [];
    for (const name of FACE_NAMES) {
        faces.push((await screen.findByName(`cube-face-${name}`)) as Gtk.Frame);
    }
    return faces;
};

describe("fixedDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(fixedDemo.id).toBe("fixed");
        expect(fixedDemo.title).toBe("Fixed Layout / Cube");
        expect(fixedDemo.windowTitle).toBe("Fixed Layout ‐ Cube");
        expect(fixedDemo.description.length).toBeGreaterThan(0);
        expect(fixedDemo.keywords).toEqual(["GtkLayoutManager"]);
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
    it("renders the six named cube-face frames", async () => {
        await renderDemo(fixedDemo);
        const faces = await findCubeFaces();
        expect(faces).toHaveLength(FACE_NAMES.length);
        for (const face of faces) {
            expect(face).toBeInstanceOf(Gtk.Frame);
        }
    });

    it("sizes each cube-face frame to the FACE_SIZE constant of 200 pixels", async () => {
        await renderDemo(fixedDemo);
        const faces = await findCubeFaces();
        for (const face of faces) {
            const [width, height] = face.getSizeRequest();
            expect(width).toBe(FACE_SIZE);
            expect(height).toBe(FACE_SIZE);
        }
    });

    it("applies a non-null GskTransform to each cube face child of the inner fixed", async () => {
        await renderDemo(fixedDemo);
        const inner = (await screen.findByName("inner-fixed")) as Gtk.Fixed;
        const faces = await findCubeFaces();
        for (const face of faces) {
            const transform = inner.getChildTransform(face);
            expect(transform).not.toBeNull();
        }
    });
});
