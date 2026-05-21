import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import { fireEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { linksDemo } from "../../../src/demos/gestures/links.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { findAllOfType } from "../../helpers/traverse.js";

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
        const { container } = await renderDemo(linksDemo);
        const label = findMarkupLabel(container);
        if (!label) throw new Error("expected GtkLabel");
        expect(label.getUseMarkup()).toBe(true);
        expect(label.getWrap()).toBe(true);
        expect(label.getWrapMode()).toBe(Pango.WrapMode.WORD);
        expect(label.getMaxWidthChars()).toBe(40);
    });

    it("includes the embedded http://en.wikipedia.org/wiki/Text anchor in the markup", async () => {
        const { container } = await renderDemo(linksDemo);
        const label = findMarkupLabel(container);
        if (!label) throw new Error("expected GtkLabel");
        const text = label.getLabel();
        expect(text).toContain("http://en.wikipedia.org/wiki/Text");
        expect(text).toContain("Flathub");
        expect(text).toContain("keynav");
    });

    it("applies the configured 20px margins to the label", async () => {
        const { container } = await renderDemo(linksDemo);
        const label = findMarkupLabel(container);
        if (!label) throw new Error("expected GtkLabel");
        expect(label.getMarginStart()).toBe(20);
        expect(label.getMarginEnd()).toBe(20);
        expect(label.getMarginTop()).toBe(20);
        expect(label.getMarginBottom()).toBe(20);
    });

    it("exposes the keynav handler URI as a clickable hyperlink in the markup", async () => {
        const { container } = await renderDemo(linksDemo);
        const label = findMarkupLabel(container);
        if (!label) throw new Error("expected GtkLabel");
        const markup = label.getLabel();
        expect(markup).toMatch(/href="keynav"/);
        expect(markup).toMatch(/href="http:\/\/www\.flathub\.org\/"/);
    });
});

describe("linksDemo activate-link handler", () => {
    it("returns true and presents the keynav alert when the 'keynav' link is activated", async () => {
        const { container } = await renderDemo(linksDemo);
        const label = findMarkupLabel(container);
        if (!label) throw new Error("expected GtkLabel");
        await fireEvent(label, "activate-link", "keynav");
    });
});
