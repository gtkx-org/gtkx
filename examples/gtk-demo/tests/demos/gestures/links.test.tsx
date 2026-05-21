import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import { describe, expect, it } from "vitest";
import { linksDemo } from "../../../src/demos/gestures/links.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";

const findAllOfType = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new (...args: never[]) => T): T[] => {
    const out: T[] = [];
    const stack: Gtk.Widget[] = [root];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        if (node instanceof ctor) out.push(node);
        let child = node.getFirstChild();
        while (child) {
            stack.push(child);
            child = child.getNextSibling();
        }
    }
    return out;
};

const findMarkupLabel = (root: Gtk.Widget): Gtk.Label | null =>
    findAllOfType(root, Gtk.Label).find((l) => l.getUseMarkup() && l.getLabel().includes("keynav")) ?? null;

describe("linksDemo", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(linksDemo, { id: "links", title: "Links" });
        expect(typeof linksDemo.sourceCode).toBe("string");
        expect(linksDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(linksDemo.keywords).toContain("link");
        expect(linksDemo.keywords).toContain("hyperlink");
        expect(linksDemo.keywords).toContain("keynav");
        expect(linksDemo.component).toBeTypeOf("function");
    });

    it("renders a markup-enabled label that wraps on word boundaries", async () => {
        if (!linksDemo.component) throw new Error("links demo component missing");
        const { container } = await renderDemo(linksDemo.component);
        const label = findMarkupLabel(container);
        if (!label) throw new Error("expected GtkLabel");
        expect(label.getUseMarkup()).toBe(true);
        expect(label.getWrap()).toBe(true);
        expect(label.getWrapMode()).toBe(Pango.WrapMode.WORD);
        expect(label.getMaxWidthChars()).toBe(40);
    });

    it("includes the embedded http://en.wikipedia.org/wiki/Text anchor in the markup", async () => {
        if (!linksDemo.component) throw new Error("links demo component missing");
        const { container } = await renderDemo(linksDemo.component);
        const label = findMarkupLabel(container);
        if (!label) throw new Error("expected GtkLabel");
        const text = label.getLabel();
        expect(text).toContain("http://en.wikipedia.org/wiki/Text");
        expect(text).toContain("Flathub");
        expect(text).toContain("keynav");
    });

    it("applies the configured 20px margins to the label", async () => {
        if (!linksDemo.component) throw new Error("links demo component missing");
        const { container } = await renderDemo(linksDemo.component);
        const label = findMarkupLabel(container);
        if (!label) throw new Error("expected GtkLabel");
        expect(label.getMarginStart()).toBe(20);
        expect(label.getMarginEnd()).toBe(20);
        expect(label.getMarginTop()).toBe(20);
        expect(label.getMarginBottom()).toBe(20);
    });

    it("exposes the keynav handler URI as a clickable hyperlink in the markup", async () => {
        if (!linksDemo.component) throw new Error("links demo component missing");
        const { container } = await renderDemo(linksDemo.component);
        const label = findMarkupLabel(container);
        if (!label) throw new Error("expected GtkLabel");
        const markup = label.getLabel();
        expect(markup).toMatch(/href="keynav"/);
        expect(markup).toMatch(/href="http:\/\/www\.flathub\.org\/"/);
    });
});
