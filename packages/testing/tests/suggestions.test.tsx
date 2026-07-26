import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { describe, expect, it } from "vitest";
import { getByName, getByRole, getByText, getSuggestedQuery, render } from "../src/index.js";

describe("getSuggestedQuery", () => {
    it("suggests getByRole with the accessible name for a button", async () => {
        const { container } = await render(<GtkButton label="Save" />);
        const button = getByRole(container, Gtk.AccessibleRole.BUTTON);
        const suggestion = getSuggestedQuery(button);
        expect(suggestion?.queryName).toBe("Role");
        expect(suggestion?.queryMethod).toBe("getByRole");
        expect(suggestion?.toString()).toBe("getByRole(Gtk.AccessibleRole.BUTTON, { name: 'Save' })");
    });

    it("honors the requested variant", async () => {
        const { container } = await render(<GtkButton label="Go" />);
        const button = getByRole(container, Gtk.AccessibleRole.BUTTON);
        const suggestion = getSuggestedQuery(button, "find");
        expect(suggestion?.variant).toBe("find");
        expect(suggestion?.toString()).toBe("findByRole(Gtk.AccessibleRole.BUTTON, { name: 'Go' })");
    });

    it("suggests getByText for a bare label", async () => {
        const { container } = await render(<GtkLabel>Just text</GtkLabel>);
        const label = getByText(container, "Just text");
        const suggestion = getSuggestedQuery(label, "query", "Text");
        expect(suggestion?.queryName).toBe("Text");
        expect(suggestion?.queryMethod).toBe("queryByText");
        expect(suggestion?.toString()).toBe("queryByText('Just text')");
    });

    it("falls back to getByName for a widget with no semantic content", async () => {
        const { container } = await render(<GtkBox name="my-box" orientation={Gtk.Orientation.VERTICAL} />);
        const box = getByName(container, "my-box");
        const suggestion = getSuggestedQuery(box);
        expect(suggestion?.queryName).toBe("Name");
        expect(suggestion?.toString()).toBe("getByName('my-box')");
    });

    it("prefers a role suggestion over a name for a widget that has both", async () => {
        const { container } = await render(<GtkButton label="Named" name="cta" />);
        const button = getByRole(container, Gtk.AccessibleRole.BUTTON);
        const suggestion = getSuggestedQuery(button, "get");
        expect(suggestion?.queryName).toBe("Role");
        expect(suggestion?.toString()).toBe("getByRole(Gtk.AccessibleRole.BUTTON, { name: 'Named' })");
    });
});
