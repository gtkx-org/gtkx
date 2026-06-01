import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkEntry, GtkLabel } from "@gtkx/react";
import { describe, expect, it } from "vitest";
import {
    queryAllByName,
    queryAllByRole,
    queryAllByText,
    queryByName,
    queryByRole,
    queryByText,
    render,
} from "../src/index.js";

describe("queryByRole", () => {
    it("returns element when found", async () => {
        const { container } = await render(<GtkButton label="Test" />);
        const button = queryByRole(container, Gtk.AccessibleRole.BUTTON, { name: "Test" });
        expect(button).not.toBeNull();
    });

    it("returns null when not found", async () => {
        const { container } = await render(<GtkLabel label="Test" />);
        const button = queryByRole(container, Gtk.AccessibleRole.BUTTON);
        expect(button).toBeNull();
    });

    it("throws when multiple elements found", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="First" />
                <GtkButton label="Second" />
            </GtkBox>,
        );
        expect(() => queryByRole(container, Gtk.AccessibleRole.BUTTON)).toThrow(/Found 2 elements/);
    });
});

describe("queryAllByRole", () => {
    it("returns all matching elements", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="First" />
                <GtkButton label="Second" />
            </GtkBox>,
        );
        const buttons = queryAllByRole(container, Gtk.AccessibleRole.BUTTON);
        expect(buttons.length).toBe(2);
    });

    it("returns empty array when none found", async () => {
        const { container } = await render(<GtkLabel label="Test" />);
        const buttons = queryAllByRole(container, Gtk.AccessibleRole.BUTTON);
        expect(buttons).toEqual([]);
    });
});

describe("queryByText", () => {
    it("returns element when found", async () => {
        const { container } = await render(<GtkLabel label="Hello" />);
        const label = queryByText(container, "Hello");
        expect(label).not.toBeNull();
    });

    it("returns null when not found", async () => {
        const { container } = await render(<GtkLabel label="Hello" />);
        const label = queryByText(container, "Goodbye");
        expect(label).toBeNull();
    });
});

describe("queryAllByText", () => {
    it("returns all matching elements", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="Same" />
                <GtkButton label="Same" />
            </GtkBox>,
        );
        const buttons = queryAllByText(container, "Same");
        expect(buttons.length).toBe(2);
    });

    it("returns empty array when none found", async () => {
        const { container } = await render(<GtkLabel label="Hello" />);
        const labels = queryAllByText(container, "Nonexistent");
        expect(labels).toEqual([]);
    });
});

describe("queryByName", () => {
    it("returns element when found", async () => {
        const { container } = await render(<GtkEntry name="email-input" />);
        const entry = queryByName(container, "email-input");
        expect(entry).not.toBeNull();
    });

    it("returns null when not found", async () => {
        const { container } = await render(<GtkEntry name="email-input" />);
        const entry = queryByName(container, "password-input");
        expect(entry).toBeNull();
    });
});

describe("queryAllByName", () => {
    it("returns all matching elements", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkEntry name="field" />
                <GtkEntry name="field" />
            </GtkBox>,
        );
        const entries = queryAllByName(container, "field");
        expect(entries.length).toBe(2);
    });

    it("returns empty array when none found", async () => {
        const { container } = await render(<GtkEntry name="email" />);
        const entries = queryAllByName(container, "nonexistent");
        expect(entries).toEqual([]);
    });
});
