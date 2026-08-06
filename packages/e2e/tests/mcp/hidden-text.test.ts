import type { SerializedWidget } from "@gtkx/mcp/internal";
import { serializeWidget, type WidgetFormatting } from "@gtkx/cli/internal";
import * as Gtk from "@gtkx/gi/gtk";
import { formatRole, getWidgetNodeText, prettyWidget, REDACTED_TEXT } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

const SECRET = "hunter2";
const testing: WidgetFormatting = { formatRole, getWidgetNodeText };

const serialize = (widget: Gtk.Widget): SerializedWidget =>
    serializeWidget(widget, (target) => target.constructor.name, testing);

const collectText = (node: SerializedWidget): (string | null)[] => [
    node.text,
    ...node.children.flatMap((child) => collectText(child)),
];

const makePasswordEntry = (text: string): Gtk.PasswordEntry => {
    const entry = new Gtk.PasswordEntry();
    entry.setText(text);

    return entry;
};

describe("serializeWidget with hidden text", () => {
    it("redacts a password entry and the text widget it wraps", () => {
        const tree = serialize(makePasswordEntry(SECRET));
        expect(JSON.stringify(tree)).not.toContain(SECRET);
        expect(tree.text).toBe(REDACTED_TEXT);
        expect(collectText(tree)).toContain(REDACTED_TEXT);
    });

    it("redacts an entry whose text was made invisible", () => {
        const entry = new Gtk.Entry();
        entry.setText(SECRET);
        entry.setVisibility(false);
        expect(JSON.stringify(serialize(entry))).not.toContain(SECRET);
    });

    it("marks nothing when a password entry is empty", () => {
        const tree = serialize(makePasswordEntry(""));
        expect(collectText(tree).every((text) => text === null)).toBe(true);
    });

    it("keeps an ordinary entry's text", () => {
        const entry = new Gtk.Entry();
        entry.setText("visible text");
        expect(serialize(entry).text).toBe("visible text");
    });
});

describe("widget tree returned to MCP clients", () => {
    it("redacts a password entry", () => {
        const tree = prettyWidget(makePasswordEntry(SECRET), { shouldHighlight: false });
        expect(tree).not.toContain(SECRET);
        expect(tree).toContain(REDACTED_TEXT);
    });
});
