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

    it("renders the linked text", async () => {
        const label = await renderLinksLabel();
        expect(label).toHaveTextContent(/Some text may be marked up as hyperlinks/);
        expect(label).toHaveTextContent(/activated via keynav/);
        expect(label).toHaveTextContent(/Flathub/);
    });
});

describe("linksDemo activate-link handler", () => {
    it("presents and closes the keynav alert dialog when the keynav link is activated", async () => {
        const label = await renderLinksLabel();
        await userEvent.tab(label);
        await userEvent.keyboard(label, "{Enter}");
        const dialog = await screen.findByRole(Gtk.AccessibleRole.ALERT_DIALOG);
        expect(within(dialog).getByText("Keyboard navigation")).toBeVisible();
        expect(within(dialog).getByText(/using a program .* via keyboard input/)).toBeVisible();
        await userEvent.click(within(dialog).getByRole(Gtk.AccessibleRole.BUTTON, { name: "OK" }));
        await waitFor(() => {
            expect(screen.queryByRole(Gtk.AccessibleRole.ALERT_DIALOG)).toBeNull();
        });
    });
});
