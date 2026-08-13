import * as Adw from "@gtkx/gi/adw";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { screen } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { linksDemo } from "../../../src/demos/gestures/links.js";
import { renderDemo } from "../../test-utils.js";

const renderLinksLabel = async (): Promise<Gtk.Label> => {
    await renderDemo(linksDemo);

    return await screen.findByName("links-label", { as: Gtk.Label });
};

describe("linksDemo", () => {
    it("exposes the expected metadata", () => {
        expect(linksDemo.id).toBe("links");
        expect(linksDemo.title).toBe("Links");
        expect(linksDemo.description).toContain("GtkLabel can show hyperlinks");
        expect(linksDemo.keywords).toEqual([]);
        expect(linksDemo.sourceCode).toContain("const linksDemo: Demo = {");
        expect(linksDemo.component).toBeTypeOf("function");
    });

    it("renders a markup-enabled label that wraps on word boundaries", async () => {
        const label = await renderLinksLabel();
        expect(label).toHaveObjectProperty("useMarkup", true);
        expect(label).toHaveObjectProperty("wrap", true);
        expect(label).toHaveObjectProperty("wrapMode", Pango.WrapMode.WORD);
        expect(label).toHaveObjectProperty("maxWidthChars", 40);
    });

    it("exposes the keynav and external anchors as clickable hyperlinks in the markup", async () => {
        const label = await renderLinksLabel();
        const markup = label.getLabel();
        expect(markup).toMatch(/href="keynav"/);
        expect(markup).toMatch(/href="https:\/\/en\.wikipedia\.org\/wiki\/Text"/);
        expect(markup).toMatch(/href="https:\/\/www\.flathub\.org\/"/);
    });
});

describe("linksDemo activate-link handler", () => {
    it("returns true and presents the keynav alert dialog when the 'keynav' link is activated", async () => {
        const label = await renderLinksLabel();
        const choose = vi.spyOn(Adw.AlertDialog.prototype, "choose").mockResolvedValue("ok");
        const setHeading = vi.spyOn(Adw.AlertDialog.prototype, "setHeading");
        const setBody = vi.spyOn(Adw.AlertDialog.prototype, "setBody");

        try {
            const isHandled = label.emit("activate-link", "keynav");
            expect(isHandled).toBe(true);
            expect(choose).toHaveBeenCalledTimes(1);
            expect(choose.mock.calls[0]?.[0]).toBe(await screen.findByRole(Gtk.AccessibleRole.WINDOW));
            expect(setHeading).toHaveBeenCalledWith("Keyboard navigation");
            expect(String(setBody.mock.calls[0]?.[0])).toContain("keyboard navigation");
        } finally {
            choose.mockRestore();
            setHeading.mockRestore();
            setBody.mockRestore();
        }
    });

    it("defers to default handling for a non-keynav link without presenting an alert dialog", async () => {
        const label = await renderLinksLabel();
        const choose = vi.spyOn(Adw.AlertDialog.prototype, "choose").mockResolvedValue("ok");
        let isReachedDefault = false;

        const stop = label.connect("activate-link", () => {
            isReachedDefault = true;

            return Gdk.EVENT_STOP;
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
