import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { fixedDemo } from "../../../src/demos/layout/fixed.js";
import { renderDemo } from "../../helpers/render-demo.js";

const findAllOfType = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new (...args: never[]) => T): T[] => {
    const matches: T[] = [];
    const visit = (widget: Gtk.Widget): void => {
        if (widget instanceof ctor) matches.push(widget);
        let child = widget.getFirstChild();
        while (child) {
            visit(child);
            child = child.getNextSibling();
        }
    };
    visit(root);
    return matches;
};

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
        if (!fixedDemo.component) throw new Error("fixed demo component missing");
        const { container } = await renderDemo(fixedDemo.component);
        const scrolledWindows = findAllOfType(container, Gtk.ScrolledWindow);
        expect(scrolledWindows.length).toBeGreaterThanOrEqual(1);
    });

    it("renders the outer and inner GtkFixed containers", async () => {
        if (!fixedDemo.component) throw new Error("fixed demo component missing");
        const { container } = await renderDemo(fixedDemo.component);
        const fixedContainers = findAllOfType(container, Gtk.Fixed);
        expect(fixedContainers).toHaveLength(2);
    });

    it("aligns the outer fixed container centrally and enables visible overflow", async () => {
        if (!fixedDemo.component) throw new Error("fixed demo component missing");
        const { container } = await renderDemo(fixedDemo.component);
        const fixedContainers = findAllOfType(container, Gtk.Fixed);
        const outer = fixedContainers[0];
        if (!outer) throw new Error("expected outer GtkFixed");
        expect(outer.getHalign()).toBe(Gtk.Align.CENTER);
        expect(outer.getValign()).toBe(Gtk.Align.CENTER);
        expect(outer.getOverflow()).toBe(Gtk.Overflow.VISIBLE);
    });
});

describe("fixedDemo cube faces", () => {
    it("renders six frames, one per cube face", async () => {
        if (!fixedDemo.component) throw new Error("fixed demo component missing");
        const { container } = await renderDemo(fixedDemo.component);
        const frames = findAllOfType(container, Gtk.Frame);
        expect(frames).toHaveLength(6);
    });

    it("sizes each cube-face frame to the FACE_SIZE constant of 200 pixels", async () => {
        if (!fixedDemo.component) throw new Error("fixed demo component missing");
        const { container } = await renderDemo(fixedDemo.component);
        const frames = findAllOfType(container, Gtk.Frame);
        for (const frame of frames) {
            const [width, height] = frame.getSizeRequest();
            expect(width).toBe(200);
            expect(height).toBe(200);
        }
    });

    it("applies a non-null GskTransform to each cube face child of the inner fixed", async () => {
        if (!fixedDemo.component) throw new Error("fixed demo component missing");
        const { container } = await renderDemo(fixedDemo.component);
        const fixedContainers = findAllOfType(container, Gtk.Fixed);
        const inner = fixedContainers[1];
        if (!inner) throw new Error("expected inner GtkFixed");
        const frames = findAllOfType(inner, Gtk.Frame);
        expect(frames).toHaveLength(6);
        for (const frame of frames) {
            const transform = inner.getChildTransform(frame);
            expect(transform).not.toBeNull();
        }
    });
});
