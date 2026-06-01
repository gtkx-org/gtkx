import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplicationWindow, GtkBox, GtkButton, GtkLabel } from "@gtkx/react";
import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "../src/index.js";

describe("screen binding", () => {
    it("routes queries through the global application container", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="First" />
                <GtkButton label="Second" />
            </GtkBox>,
        );

        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "First" });
        const all = await screen.findAllByRole(Gtk.AccessibleRole.BUTTON, { name: /First|Second/ });

        expect(button).toBeDefined();
        expect(all.length).toBe(2);
    });

    it("throws when no render has been performed", async () => {
        await cleanup();
        expect(() => screen.findByRole(Gtk.AccessibleRole.BUTTON, { timeout: 100 })).toThrow(
            "No render has been performed",
        );
    });
});

describe("screen screenshot capture", () => {
    it("captures the first window when no selector is provided", async () => {
        await render(<GtkLabel label="Snapshot" />);

        const result = await screen.screenshot();

        expect(result.mimeType).toBe("image/png");
        expect(result.data.length).toBeGreaterThan(0);
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
    });

    it("captures the window at the requested index", async () => {
        await render(<GtkLabel label="Indexed" />);

        const result = await screen.screenshot(0);

        expect(result.mimeType).toBe("image/png");
        expect(result.data.length).toBeGreaterThan(0);
    });

    it("throws when the index is out of range", async () => {
        await render(<GtkLabel label="Bounds" />);

        await expect(screen.screenshot(99)).rejects.toThrow(/Window at index 99 not found/);
    });
});

describe("screen screenshot selectors", () => {
    it("captures a window matching a title substring", async () => {
        await render(<GtkLabel label="Titled" />, {
            wrapper: ({ children }) => (
                <GtkApplicationWindow title="Settings Window" defaultWidth={120} defaultHeight={80}>
                    {children}
                </GtkApplicationWindow>
            ),
        });

        const result = await screen.screenshot("Settings");

        expect(result.mimeType).toBe("image/png");
    });

    it("captures a window matching a title regex", async () => {
        await render(<GtkLabel label="Pattern" />, {
            wrapper: ({ children }) => (
                <GtkApplicationWindow title="Demo Pattern App" defaultWidth={120} defaultHeight={80}>
                    {children}
                </GtkApplicationWindow>
            ),
        });

        const result = await screen.screenshot(/^Demo/);

        expect(result.mimeType).toBe("image/png");
    });
});

describe("screen screenshot errors", () => {
    it.each([
        ["throws when no window matches a string selector", "Nonexistent" as string | RegExp],
        ["throws when no window matches a regex selector", /^Bogus/],
    ])("%s", async (_title, selector) => {
        await render(<GtkLabel label="Unmatched" />, {
            wrapper: ({ children }) => (
                <GtkApplicationWindow title="Real Title" defaultWidth={120} defaultHeight={80}>
                    {children}
                </GtkApplicationWindow>
            ),
        });

        await expect(screen.screenshot(selector)).rejects.toThrow(/No window found with title matching/);
    });

    it("throws when no windows are available", async () => {
        await cleanup();

        await expect(screen.screenshot()).rejects.toThrow(/No windows available for screenshot/);
    });
});
