import * as Gtk from "@gtkx/gi/gtk";
import { GtkEntry, GtkPasswordEntry } from "@gtkx/jsx/gtk";
import { describe, expect, it } from "vitest";
import {
    getSuggestedQuery,
    getWidgetNodeText,
    getWidgetTextContent,
    prettyWidget,
    render,
    screen,
} from "../src/index.js";

const SECRET = "hunter2";
const REDACTED = "[redacted]";

const renderPasswordEntry = async (text: string): Promise<Gtk.Widget> => {
    await render(<GtkPasswordEntry name="password" text={text} />);

    return screen.findByName("password");
};

describe("hidden text redaction", () => {
    it("keeps a password entry's text out of the pretty-printed tree", async () => {
        const entry = await renderPasswordEntry(SECRET);
        const output = prettyWidget(entry);
        expect(output).not.toContain(SECRET);
        expect(output).toContain(REDACTED);
    });

    it("redacts a password entry's own text and its subtree text", async () => {
        const entry = await renderPasswordEntry(SECRET);
        expect(getWidgetNodeText(entry)).toBe(REDACTED);
        expect(getWidgetTextContent(entry)).not.toContain(SECRET);
    });

    it("marks nothing when a password entry is empty", async () => {
        const entry = await renderPasswordEntry("");
        expect(getWidgetNodeText(entry)).toBeNull();
        expect(prettyWidget(entry)).not.toContain(REDACTED);
    });

    it("redacts an entry whose text was made invisible", async () => {
        await render(<GtkEntry name="pin" text={SECRET} visibility={false} />);
        const entry = await screen.findByName("pin");
        expect(getWidgetNodeText(entry)).toBe(REDACTED);
        expect(prettyWidget(entry)).not.toContain(SECRET);
    });

    it("redacts a visible entry that declares a password input purpose", async () => {
        await render(<GtkEntry name="peeked" text={SECRET} inputPurpose={Gtk.InputPurpose.PASSWORD} />);
        const entry = await screen.findByName("peeked");
        expect(getWidgetNodeText(entry)).toBe(REDACTED);
        expect(prettyWidget(entry)).not.toContain(SECRET);
    });

    it("keeps redacting a password entry whose text was revealed by its peek icon", async () => {
        const entry = await renderPasswordEntry(SECRET);
        const delegate = entry instanceof Gtk.Editable ? entry.getDelegate() : null;
        expect(delegate).toBeInstanceOf(Gtk.Text);

        if (delegate instanceof Gtk.Text) {
            delegate.setVisibility(true);
        }

        expect(getWidgetNodeText(entry)).toBe(REDACTED);
        expect(prettyWidget(entry)).not.toContain(SECRET);
    });

    it("leaves an ordinary entry's text readable", async () => {
        await render(<GtkEntry name="plain" text="visible text" />);
        const entry = await screen.findByName("plain");
        expect(getWidgetNodeText(entry)).toBe("visible text");
        expect(prettyWidget(entry)).toContain("visible text");
    });
});

describe("hidden text in accessible properties", () => {
    it("redacts the display value of a password entry", async () => {
        const entry = await renderPasswordEntry(SECRET);
        expect(entry).toHaveDisplayValue(REDACTED);
    });

    it("redacts a selection taken from a password entry", async () => {
        const entry = await renderPasswordEntry(SECRET);
        expect(entry).toBeInstanceOf(Gtk.Editable);

        if (entry instanceof Gtk.Editable) {
            entry.selectRegion(0, -1);
        }

        expect(entry).toHaveSelection(REDACTED);
    });

    it("keeps the hidden text out of the accessible name", async () => {
        await renderPasswordEntry(SECRET);
        expect(screen.queryByRole(Gtk.AccessibleRole.TEXT_BOX, { name: SECRET })).toBeNull();
    });

    it("still names a labelled entry whose text is hidden", async () => {
        await render(<GtkEntry name="secret" text={SECRET} visibility={false} accessibleLabel="Password" />);
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Password" });
        expect(entry.getName()).toBe("secret");
    });

    it("never suggests a query carrying the hidden text", async () => {
        const entry = await renderPasswordEntry(SECRET);
        const suggestion = getSuggestedQuery(entry, "get", "DisplayValue");
        expect(String(suggestion)).not.toContain(SECRET);
        expect(String(suggestion)).toContain(REDACTED);
    });
});
