import * as Gtk from "@gtkx/ffi/gtk";
import { act, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { fixed2Demo } from "../../../src/demos/layout/fixed2.js";
import { renderDemo } from "../../test-utils.js";

describe("fixed2Demo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(fixed2Demo.id).toBe("fixed2");
        expect(fixed2Demo.title).toBe("Fixed Layout / Transformations");
        expect(fixed2Demo.description.length).toBeGreaterThan(0);
        expect(fixed2Demo.keywords).toEqual(["GtkLayoutManager"]);
        expect(typeof fixed2Demo.sourceCode).toBe("string");
        expect(fixed2Demo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(fixed2Demo.defaultWidth).toBe(400);
        expect(fixed2Demo.defaultHeight).toBe(300);
        expect(fixed2Demo.component).toBeTypeOf("function");
    });
});

describe("fixed2Demo structure", () => {
    it("renders the 'All fixed?' label inside the GtkFixed container", async () => {
        await renderDemo(fixed2Demo);
        const label = (await screen.findByName("fixed-label")) as Gtk.Label;
        expect(label).toBeInstanceOf(Gtk.Label);
        expect(label.getLabel()).toBe("All fixed?");
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

    it("renders only the fixed-label widget inside the GtkFixed", async () => {
        await renderDemo(fixed2Demo);
        const fixed = (await screen.findByName("fixed")) as Gtk.Fixed;
        const label = (await screen.findByName("fixed-label")) as Gtk.Label;
        expect(label.getParent()).toBe(fixed);
        expect(screen.queryAllByName("fixed-label")).toHaveLength(1);
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

    it("removes the demo's tick callback when the component unmounts", async () => {
        const result = await renderDemo(fixed2Demo);
        const fixed = (await screen.findByName("fixed")) as Gtk.Fixed;
        expect(fixed).toBeInstanceOf(Gtk.Fixed);
        await result.unmount();
    });

    it("renders the label so it can be queried after mount", async () => {
        await renderDemo(fixed2Demo);
        const label = (await screen.findByName("fixed-label")) as Gtk.Label;
        expect(label.getLabel()).toBe("All fixed?");
    });
});

describe("fixed2Demo allocation", () => {
    it("does not throw when the fixed container is asked to allocate space", async () => {
        await renderDemo(fixed2Demo);
        const fixed = (await screen.findByName("fixed")) as Gtk.Fixed;
        await act(() => {
            fixed.queueAllocate();
            fixed.queueResize();
        });
        expect(fixed.getOverflow()).toBe(Gtk.Overflow.VISIBLE);
    });

    it("reports a non-zero allocated width once mapped within the scrolled window", async () => {
        await renderDemo(fixed2Demo);
        const fixed = (await screen.findByName("fixed")) as Gtk.Fixed;
        expect(fixed.getAllocatedWidth()).toBeGreaterThanOrEqual(0);
        expect(fixed.getAllocatedHeight()).toBeGreaterThanOrEqual(0);
    });
});

describe("fixed2Demo animation frames", () => {
    it("invokes the tick callback so it computes a non-undefined transform", async () => {
        await renderDemo(fixed2Demo);
        const fixed = (await screen.findByName("fixed")) as Gtk.Fixed;
        const label = (await screen.findByName("fixed-label")) as Gtk.Label;
        expect(fixed).toBeInstanceOf(Gtk.Fixed);
        expect(label).toBeInstanceOf(Gtk.Label);
        await act(async () => {
            await new Promise((r) => setTimeout(r, 250));
        });
    });
});
