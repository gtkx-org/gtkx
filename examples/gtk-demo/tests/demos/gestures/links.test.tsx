import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { linksDemo } from "../../../src/demos/gestures/links.js";
import { renderDemo } from "../../test-utils.js";

const renderLinksLabel = async (): Promise<Gtk.Label> => {
    await renderDemo(linksDemo);

    return await screen.findByName("links-label", { as: Gtk.Label });
};

describe("linksDemo", () => {
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
    it("presents and closes the keynav alert dialog when the keynav link is activated", async () => {
        const label = await renderLinksLabel();
        expect(label.emit("activate-link", "keynav")).toBe(true);
        const dialog = await screen.findByRole(Gtk.AccessibleRole.ALERT_DIALOG);
        expect(within(dialog).getByText("Keyboard navigation")).toBeVisible();
        expect(within(dialog).getByText(/using a program .* via keyboard input/)).toBeVisible();
        await userEvent.click(within(dialog).getByRole(Gtk.AccessibleRole.BUTTON, { name: "OK" }));
        await waitFor(() => {
            expect(screen.queryByRole(Gtk.AccessibleRole.ALERT_DIALOG)).toBeNull();
        });
    });

    it("defers to default handling for a non-keynav link without presenting an alert dialog", async () => {
        const label = await renderLinksLabel();
        let isReachedDefault = false;

        const stop = label.connect("activate-link", () => {
            isReachedDefault = true;

            return Gdk.EVENT_STOP;
        });

        label.emit("activate-link", "https://www.flathub.org/");
        expect(isReachedDefault).toBe(true);
        expect(screen.queryByRole(Gtk.AccessibleRole.ALERT_DIALOG)).toBeNull();
        label.disconnect(stop);
    });
});
