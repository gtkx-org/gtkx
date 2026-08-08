import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel, GtkMenuButton, GtkPopover, GtkWindow } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { act, render, screen, screenshot } from "../src/index.js";
import { decodePngSize } from "./png-helpers.js";

const renderMenuButton = async (popoverRef: RefObject<Gtk.Popover | null>): Promise<Gtk.Widget> => {
    const { container } = await render(
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkMenuButton label="Open">
                <GtkPopover ref={popoverRef}>
                    <GtkLabel>Inside the popover</GtkLabel>
                </GtkPopover>
            </GtkMenuButton>
        </GtkBox>,
    );

    return container;
};

const settle = async (action: () => void): Promise<void> => {
    await act(async () => {
        action();
        await Promise.resolve();
    });
};

describe("screenshot popovers", () => {
    it("composites an open popover into the window image", async () => {
        const popoverRef = createRef<Gtk.Popover>();
        const window = await renderMenuButton(popoverRef);
        const closed = await screenshot(window);
        await settle(() => popoverRef.current?.popup());
        expect(popoverRef.current?.getMapped()).toBe(true);
        const opened = await screenshot(window);
        await settle(() => popoverRef.current?.popdown());
        const reclosed = await screenshot(window);
        expect(opened.data).not.toBe(closed.data);
        expect(reclosed.data).toBe(closed.data);
    });

    it("clips a popover that spills outside the captured widget", async () => {
        const popoverRef = createRef<Gtk.Popover>();
        await renderMenuButton(popoverRef);
        const button = await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON);
        const closed = await screenshot(button);
        await settle(() => popoverRef.current?.popup());
        const opened = await screenshot(button);
        expect(opened.width).toBe(closed.width);
        expect(opened.height).toBe(closed.height);
        expect(decodePngSize(opened.data)).toEqual({ width: opened.width, height: opened.height });
    });

    it("produces a stable image while every popover stays closed", async () => {
        const popoverRef = createRef<Gtk.Popover>();
        const window = await renderMenuButton(popoverRef);
        const first = await screenshot(window);
        const second = await screenshot(window);
        expect(popoverRef.current?.getMapped()).toBe(false);
        expect(second.data).toBe(first.data);
    });
});

describe("screenshot scale", () => {
    it("supersamples the capture by the requested factor", async () => {
        const { container } = await render(<GtkLabel>Scaled</GtkLabel>);
        const base = await screenshot(container);
        const scaled = await screenshot(container, { scale: 2 });
        expect(scaled.width).toBe(base.width * 2);
        expect(scaled.height).toBe(base.height * 2);
        expect(decodePngSize(scaled.data)).toEqual({ width: scaled.width, height: scaled.height });
        expect(decodePngSize(base.data)).toEqual({ width: base.width, height: base.height });
    });

    it("rejects a non-positive scale", async () => {
        const { container } = await render(<GtkLabel>Invalid scale</GtkLabel>);
        await expect(screenshot(container, { scale: 0 })).rejects.toThrow(/positive number/);
    });
});

describe("screen screenshot", () => {
    it("captures the active toplevel rather than the render's own container", async () => {
        await render(
            <>
                <GtkWindow title="Background" defaultWidth={120} defaultHeight={80}>
                    <GtkLabel>Behind everything</GtkLabel>
                </GtkWindow>
                <GtkWindow title="Foreground" defaultWidth={200} defaultHeight={140}>
                    <GtkLabel>In front of everything</GtkLabel>
                </GtkWindow>
            </>,
            { container: rootElement },
        );

        const foreground = await screen.findByRole(Gtk.AccessibleRole.WINDOW, {
            name: "Foreground",
            as: Gtk.Window,
        });

        await act(() => {
            foreground.present();
        });

        const background = await screen.findByRole(Gtk.AccessibleRole.WINDOW, {
            name: "Background",
            as: Gtk.Window,
        });

        const captured = await screen.screenshot();
        const direct = await screenshot(foreground);
        const behind = await screenshot(background);
        expect(captured.width).toBe(direct.width);
        expect(captured.height).toBe(direct.height);
        expect(captured.data).toBe(direct.data);
        expect(captured.data).not.toBe(behind.data);
    });

    it("reports that nothing is on screen once every toplevel is hidden", async () => {
        await render(
            <GtkWindow title="Hidden" defaultWidth={120} defaultHeight={80}>
                <GtkLabel>Out of sight</GtkLabel>
            </GtkWindow>,
            { container: rootElement },
        );

        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "Hidden", as: Gtk.Window });

        await act(() => {
            window.setVisible(false);
        });

        await expect(screen.screenshot()).rejects.toThrow(/Nothing is on screen/);
    });
});

describe("screenshot path", () => {
    it("writes the PNG to the requested file, creating missing directories", async () => {
        const { container } = await render(<GtkLabel>Saved</GtkLabel>);
        const directory = mkdtempSync(join(tmpdir(), "gtkx-screenshots-"));
        const path = join(directory, "nested", "shot.png");
        const result = await screenshot(container, { path });
        const written = readFileSync(path);
        expect(written.toString("base64")).toBe(result.data);
        expect(decodePngSize(result.data)).toEqual({ width: result.width, height: result.height });
    });

    it("returns the image without touching the filesystem when no path is given", async () => {
        const { container } = await render(<GtkLabel>Unsaved</GtkLabel>);
        const result = await screenshot(container);
        expect(result.mimeType).toBe("image/png");
        expect(result.data.length).toBeGreaterThan(0);
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
    });
});
