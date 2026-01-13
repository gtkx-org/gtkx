import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkCheckButton, GtkLabel } from "@gtkx/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRoles, prettyRoles, render, screen } from "../src/index.js";

describe("getRoles", () => {
    it("returns map of roles to widgets", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="Submit" />
                <GtkButton label="Cancel" />
                <GtkLabel label="Hello" />
            </GtkBox>,
        );

        const roles = getRoles(container);

        expect(roles.has("button")).toBe(true);
        expect(roles.has("label")).toBe(true);
        expect(roles.get("button")?.length).toBe(2);
    });

    it("includes accessible names", async () => {
        const { container } = await render(<GtkButton label="My Button" />);

        const roles = getRoles(container);
        const buttons = roles.get("button");

        expect(buttons?.[0]?.name).toBe("My Button");
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
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
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
