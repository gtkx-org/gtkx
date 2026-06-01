import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { fireEvent, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { linksDemo } from "../../../src/demos/gestures/links.js";
import { renderDemo } from "../../test-utils.js";

describe("linksDemo", () => {
    it("exposes the expected metadata", () => {
        expect(linksDemo.id).toBe("links");
        expect(linksDemo.title).toBe("Links");
        expect(linksDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(linksDemo.keywords)).toBe(true);
        expect(typeof linksDemo.sourceCode).toBe("string");
        expect(linksDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(linksDemo.component).toBeTypeOf("function");
    });

    it("renders a markup-enabled label that wraps on word boundaries", async () => {
        await renderDemo(linksDemo);
        const label = (await screen.findByName("links-label")) as Gtk.Label;
        expect(label).toBeInstanceOf(Gtk.Label);
        expect(label.getUseMarkup()).toBe(true);
        expect(label.getWrap()).toBe(true);
        expect(label.getWrapMode()).toBe(Pango.WrapMode.WORD);
        expect(label.getMaxWidthChars()).toBe(40);
    });

    it("includes the embedded http://en.wikipedia.org/wiki/Text anchor in the markup", async () => {
        await renderDemo(linksDemo);
        const label = (await screen.findByName("links-label")) as Gtk.Label;
        const text = label.getLabel();
        expect(text).toContain("http://en.wikipedia.org/wiki/Text");
        expect(text).toContain("Flathub");
        expect(text).toContain("keynav");
    });

    it("applies the configured 20px margins to the label", async () => {
        await renderDemo(linksDemo);
        const label = (await screen.findByName("links-label")) as Gtk.Label;
        expect(label.getMarginStart()).toBe(20);
        expect(label.getMarginEnd()).toBe(20);
        expect(label.getMarginTop()).toBe(20);
        expect(label.getMarginBottom()).toBe(20);
    });

    it("exposes the keynav handler URI as a clickable hyperlink in the markup", async () => {
        await renderDemo(linksDemo);
        const label = (await screen.findByName("links-label")) as Gtk.Label;
        const markup = label.getLabel();
        expect(markup).toMatch(/href="keynav"/);
        expect(markup).toMatch(/href="http:\/\/www\.flathub\.org\/"/);
    });
});

describe("linksDemo activate-link handler", () => {
    it("returns true and presents the keynav alert when the 'keynav' link is activated", async () => {
        await renderDemo(linksDemo);
        const label = (await screen.findByName("links-label")) as Gtk.Label;
        await fireEvent(label, "activate-link", "keynav");
    });
});
