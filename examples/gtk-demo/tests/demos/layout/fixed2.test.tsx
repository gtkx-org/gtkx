import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { fixed2Demo } from "../../../src/demos/layout/fixed2.js";
import { renderDemo } from "../../helpers/render-demo.js";
import { findAllOfType } from "../../helpers/traverse.js";

describe("fixed2Demo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(fixed2Demo.id).toBe("fixed2");
        expect(fixed2Demo.title).toBe("Fixed Layout / Transformations");
        expect(fixed2Demo.description.length).toBeGreaterThan(0);
        expect(fixed2Demo.keywords).toEqual(
            expect.arrayContaining([
                "fixed",
                "transform",
                "GskTransform",
                "GdkFrameClock",
                "addTickCallback",
                "animation",
            ]),
        );
        expect(typeof fixed2Demo.sourceCode).toBe("string");
        expect(fixed2Demo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(fixed2Demo.defaultWidth).toBe(400);
        expect(fixed2Demo.defaultHeight).toBe(300);
        expect(fixed2Demo.component).toBeTypeOf("function");
    });
});

describe("fixed2Demo structure", () => {
    it("renders the 'All fixed?' label inside the GtkFixed container", async () => {
        const { container } = await renderDemo(fixed2Demo);
        const labels = findAllOfType(container, Gtk.Label).filter((l) => l.getLabel() === "All fixed?");
        expect(labels).toHaveLength(1);
        const [label] = labels;
        if (!label) throw new Error("expected label");
        expect(label.getParent()).toBeInstanceOf(Gtk.Fixed);
    });

    it("nests the GtkFixed inside a hexpand+vexpand GtkScrolledWindow", async () => {
        await renderDemo(fixed2Demo);
        const sw = (await screen.findByName("scrolled")) as Gtk.ScrolledWindow;
        expect(sw.getHexpand()).toBe(true);
        expect(sw.getVexpand()).toBe(true);
        const fixed = await screen.findByName("fixed");
        expect(fixed).toBeInstanceOf(Gtk.Fixed);
    });
});

describe("fixed2Demo configuration", () => {
    it("configures the GtkFixed with visible overflow and expand flags", async () => {
        await renderDemo(fixed2Demo);
        const fixed = (await screen.findByName("fixed")) as Gtk.Fixed;
        expect(fixed.getOverflow()).toBe(Gtk.Overflow.VISIBLE);
        expect(fixed.getHexpand()).toBe(true);
        expect(fixed.getVexpand()).toBe(true);
    });

    it("places exactly one widget as a child of the GtkFixed", async () => {
        await renderDemo(fixed2Demo);
        const fixed = (await screen.findByName("fixed")) as Gtk.Fixed;
        let count = 0;
        let child = fixed.getFirstChild();
        while (child) {
            count++;
            child = child.getNextSibling();
        }
        expect(count).toBe(1);
    });
});

describe("fixed2Demo animation tick", () => {
    it("installs a tick callback on the GtkFixed", async () => {
        await renderDemo(fixed2Demo);
        const fixed = (await screen.findByName("fixed")) as Gtk.Fixed;
        const newCallbackId = fixed.addTickCallback(() => false);
        expect(newCallbackId).toBeGreaterThan(1);
        fixed.removeTickCallback(newCallbackId);
    });
});
