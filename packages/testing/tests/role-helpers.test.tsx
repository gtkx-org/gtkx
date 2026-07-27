import type { MockInstance } from "vitest";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkCheckButton, GtkLabel } from "@gtkx/jsx/gtk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRoles, getWidgetNodeText, prettyRoles, render, screen } from "../src/index.js";

describe("getRoles", () => {
    it("returns map of roles to widgets", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="Submit" />
                <GtkButton label="Cancel" />
                <GtkLabel>Hello</GtkLabel>
            </GtkBox>,
        );

        const roles = getRoles(container);
        expect(roles.has("button")).toBe(true);
        expect(roles.has("label")).toBe(true);
        expect(roles.get("button")?.length).toBe(2);
    });

    it("maps each role to its widgets", async () => {
        const { container } = await render(<GtkButton label="My Button" />);
        const roles = getRoles(container);
        const button = roles.get("button")?.[0];
        expect(button).toBeInstanceOf(Gtk.Button);
        expect(button && getWidgetNodeText(button)).toBe("My Button");
    });

    it("returns empty map for empty container", async () => {
        const { container } = await render(<GtkBox orientation={Gtk.Orientation.VERTICAL} />);
        const roles = getRoles(container);
        expect(roles.has("button")).toBe(false);
    });
});

describe("prettyRoles", () => {
    it("formats roles with names", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="Submit" />
                <GtkCheckButton label="Remember" />
            </GtkBox>,
        );

        const output = prettyRoles(container);
        expect(output).toContain("button:");
        expect(output).toContain("Submit");
        expect(output).toContain("checkbox:");
        expect(output).toContain("Remember");
    });

    it("formats all roles including window and generic", async () => {
        const { container } = await render(<GtkBox orientation={Gtk.Orientation.VERTICAL} />);
        const output = prettyRoles(container);
        expect(output).toContain("window:");
        expect(output).toContain("generic:");
    });
});

describe("logRoles", () => {
    let consoleSpy: MockInstance<typeof console.log>;

    beforeEach(() => {
        consoleSpy = vi.spyOn(console, "log").mockImplementation(vi.fn());
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    it("logs roles to console via screen.logRoles", async () => {
        await render(<GtkButton label="Test" />);
        screen.logRoles();
        expect(consoleSpy).toHaveBeenCalled();
        const output = consoleSpy.mock.calls[0]?.[0] as string;
        expect(output).toContain("button:");
    });
});
