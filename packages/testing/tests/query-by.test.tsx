import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkEntry, GtkLabel } from "@gtkx/react";
import { describe, expect, it } from "vitest";
import {
    queryAllByRole,
    queryAllByTestId,
    queryAllByText,
    queryByRole,
    queryByTestId,
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
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
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
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
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
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkLabel label="Same" />
                <GtkLabel label="Same" />
            </GtkBox>,
        );
        const labels = queryAllByText(container, "Same");
        expect(labels.length).toBe(2);
    });

    it("returns empty array when none found", async () => {
        const { container } = await render(<GtkLabel label="Hello" />);
        const labels = queryAllByText(container, "Nonexistent");
        expect(labels).toEqual([]);
    });
});

describe("queryByTestId", () => {
    it("returns element when found", async () => {
        const { container } = await render(<GtkEntry name="email-input" />);
        const entry = queryByTestId(container, "email-input");
        expect(entry).not.toBeNull();
    });

    it("returns null when not found", async () => {
        const { container } = await render(<GtkEntry name="email-input" />);
        const entry = queryByTestId(container, "password-input");
        expect(entry).toBeNull();
    });
});

describe("queryAllByTestId", () => {
    it("returns all matching elements", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkEntry name="field" />
                <GtkEntry name="field" />
            </GtkBox>,
        );
        const entries = queryAllByTestId(container, "field");
        expect(entries.length).toBe(2);
    });

    it("returns empty array when none found", async () => {
        const { container } = await render(<GtkEntry name="email" />);
        const entries = queryAllByTestId(container, "nonexistent");
        expect(entries).toEqual([]);
    });
});
