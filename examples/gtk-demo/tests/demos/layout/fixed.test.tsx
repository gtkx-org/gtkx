import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { fixedDemo } from "../../../src/demos/layout/fixed.js";
import { renderDemo } from "../../test-utils.js";

const FACE_NAMES = ["back", "left", "bottom", "right", "top", "front"] as const;
const FACE_SIZE = 200;

const findCubeFaces = async (): Promise<Gtk.Frame[]> => {
    const faces: Gtk.Frame[] = [];

    for (const name of FACE_NAMES) {
        faces.push(await screen.findByName(`cube-face-${name}`, { as: Gtk.Frame }));
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
    it("wraps the outer fixed inside the scrolled window's viewport", async () => {
        await renderDemo(fixedDemo);
        const scrolled = await screen.findByName("scrolled", { as: Gtk.ScrolledWindow });
        const outer = await screen.findByName("outer-fixed", { as: Gtk.Fixed });
        const viewport = scrolled.getChild();
        expect(viewport).toBeInstanceOf(Gtk.Viewport);
        expect(viewport).toHaveObjectProperty("child", outer);
    });

    it("nests the inner GtkFixed as a child of the outer GtkFixed", async () => {
        await renderDemo(fixedDemo);
        const outer = await screen.findByName("outer-fixed", { as: Gtk.Fixed });
        const inner = await screen.findByName("inner-fixed", { as: Gtk.Fixed });
        expect(inner.getParent()).toBe(outer);
        expect(outer.getChildTransform(inner)).not.toBeNull();
    });

    it("aligns the outer fixed container centrally and enables visible overflow", async () => {
        await renderDemo(fixedDemo);
        const outer = await screen.findByName("outer-fixed", { as: Gtk.Fixed });
        expect(outer).toHaveObjectProperty("halign", Gtk.Align.CENTER);
        expect(outer).toHaveObjectProperty("valign", Gtk.Align.CENTER);
        expect(outer).toHaveObjectProperty("overflow", Gtk.Overflow.VISIBLE);
    });
});

describe("fixedDemo cube faces", () => {
    it("renders the six named cube-face frames each carrying its face-name CSS class", async () => {
        await renderDemo(fixedDemo);
        const faces = await findCubeFaces();
        expect(faces).toHaveLength(FACE_NAMES.length);

        for (const [i, name] of FACE_NAMES.entries()) {
            expect(faces[i]).toHaveClass(name);
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

    it("gives every cube face a distinct 3D GskTransform on the inner fixed", async () => {
        await renderDemo(fixedDemo);
        const inner = await screen.findByName("inner-fixed", { as: Gtk.Fixed });
        const faces = await findCubeFaces();

        const transformStrings = faces.map((face) => {
            const transform = inner.getChildTransform(face);
            expect(transform).not.toBeNull();

            return transform?.toString();
        });

        expect(new Set(transformStrings).size).toBe(FACE_NAMES.length);
    });
});
