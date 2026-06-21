import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkWindow } from "@gtkx/jsx/gtk";
import { createRootElement } from "@gtkx/react";
import { describe, expect, it } from "vitest";
import { captureAndSaveScreenshot, cleanup, render, screen } from "../src/index.js";

describe("screen binding", () => {
    it("routes queries through the global toplevel scope", async () => {
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

const decodePngSize = (base64Data: string): { width: number; height: number } => {
    const bytes = Buffer.from(base64Data, "base64");
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

describe("screen screenshot scale", () => {
    it("supersamples the capture by the requested factor", async () => {
        await render(<GtkLabel label="Scaled" />);

        const base = await screen.screenshot(0);
        const scaled = await screen.screenshot(0, { scale: 2 });

        expect(scaled.width).toBe(base.width * 2);
        expect(scaled.height).toBe(base.height * 2);
        expect(decodePngSize(scaled.data)).toEqual({ width: scaled.width, height: scaled.height });
        expect(decodePngSize(base.data)).toEqual({ width: base.width, height: base.height });
    });

    it("rejects a non-positive scale", async () => {
        await render(<GtkLabel label="Invalid scale" />);

        await expect(screen.screenshot(0, { scale: 0 })).rejects.toThrow(/positive number/);
    });
});

describe("screen screenshot selectors", () => {
    it("captures a window matching a title substring", async () => {
        await render(
            <GtkWindow title="Settings Window" defaultWidth={120} defaultHeight={80}>
                <GtkLabel label="Titled" />
            </GtkWindow>,
            { container: createRootElement() },
        );

        const result = await screen.screenshot("Settings");

        expect(result.mimeType).toBe("image/png");
    });

    it("captures a window matching a title regex", async () => {
        await render(
            <GtkWindow title="Demo Pattern App" defaultWidth={120} defaultHeight={80}>
                <GtkLabel label="Pattern" />
            </GtkWindow>,
            { container: createRootElement() },
        );

        const result = await screen.screenshot(/^Demo/);

        expect(result.mimeType).toBe("image/png");
    });
});

describe("screen screenshot errors", () => {
    it.each([
        ["throws when no window matches a string selector", "Nonexistent" as string | RegExp],
        ["throws when no window matches a regex selector", /^Bogus/],
    ])("%s", async (_title, selector) => {
        await render(
            <GtkWindow title="Real Title" defaultWidth={120} defaultHeight={80}>
                <GtkLabel label="Unmatched" />
            </GtkWindow>,
            { container: createRootElement() },
        );

        await expect(screen.screenshot(selector)).rejects.toThrow(/No window found with title matching/);
    });

    it("throws when no windows are available", async () => {
        await cleanup();

        await expect(captureAndSaveScreenshot()).rejects.toThrow(/No windows available for screenshot/);
    });
});
