import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { screen } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
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

    it("exposes the keynav and external anchors as clickable hyperlinks in the markup", async () => {
        await renderDemo(linksDemo);
        const label = (await screen.findByName("links-label")) as Gtk.Label;
        const markup = label.getLabel();
        expect(markup).toMatch(/href="keynav"/);
        expect(markup).toMatch(/href="https:\/\/en\.wikipedia\.org\/wiki\/Text"/);
        expect(markup).toMatch(/href="https:\/\/www\.flathub\.org\/"/);
    });
});

describe("linksDemo activate-link handler", () => {
    it("returns true and presents the keynav alert dialog when the 'keynav' link is activated", async () => {
        await renderDemo(linksDemo);
        const label = (await screen.findByName("links-label")) as Gtk.Label;
        const choose = vi.spyOn(Adw.AlertDialog.prototype, "choose").mockResolvedValue("ok");
        const setHeading = vi.spyOn(Adw.AlertDialog.prototype, "setHeading");
        const setBody = vi.spyOn(Adw.AlertDialog.prototype, "setBody");

        try {
            const isHandled = label.emit("activate-link", "keynav");
            expect(isHandled).toBe(true);
            expect(choose).toHaveBeenCalledTimes(1);
            expect(choose.mock.calls[0]?.[0]).toBeInstanceOf(Gtk.Window);
            expect(setHeading).toHaveBeenCalledWith("Keyboard navigation");
            expect(String(setBody.mock.calls[0]?.[0])).toContain("keyboard navigation");
        } finally {
            choose.mockRestore();
            setHeading.mockRestore();
            setBody.mockRestore();
        }
    });

    it("defers to default handling for a non-keynav link without presenting an alert dialog", async () => {
        await renderDemo(linksDemo);
        const label = (await screen.findByName("links-label")) as Gtk.Label;
        const choose = vi.spyOn(Adw.AlertDialog.prototype, "choose").mockResolvedValue("ok");
        let isReachedDefault = false;

        const stop = label.connect("activate-link", () => {
            isReachedDefault = true;

            return true;
        });

        try {
            label.emit("activate-link", "https://www.flathub.org/");
            expect(isReachedDefault).toBe(true);
            expect(choose).not.toHaveBeenCalled();
        } finally {
            label.disconnect(stop);
            choose.mockRestore();
        }
    });
});
