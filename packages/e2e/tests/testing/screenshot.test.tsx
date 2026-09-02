import type { RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel, GtkMenuButton, GtkPopover, GtkWindow } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { act, render, screen, screenshot, waitFor } from "@gtkx/testing";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { decodePngSize } from "./png-helpers.js";

const SETTLE_MS = 300;

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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

const clearHover = async (widget: Gtk.Widget): Promise<void> => {
    await settle(() => {
        widget.unsetStateFlags(Gtk.StateFlags.PRELIGHT);
    });
};

const firstWindow = (): Gtk.Window => {
    const [toplevel] = Gtk.Window.listToplevels();

    if (!(toplevel instanceof Gtk.Window)) {
        throw new TypeError("No toplevel window was rendered");
    }

    return toplevel;
};

const stopPresenting = (window: Gtk.Window): void => {
    const surface = window.getNative()?.getSurface();

    if (!surface) {
        throw new TypeError("Window has no surface");
    }

    surface.hide();
};

const widgetFor = <T extends Gtk.Widget>(ref: RefObject<T | null>): T => {
    const { current } = ref;

    if (!current) {
        throw new TypeError("Ref was never attached");
    }

    return current;
};

describe("screenshot", () => {
    it("returns a PNG whose declared size matches the encoded one and supersamples on request", async () => {
        const { container } = await render(<GtkLabel>Scaled</GtkLabel>);
        const base = await screenshot(container);
        const scaled = await screenshot(container, { scale: 2 });
        expect(base.mimeType).toBe("image/png");
        expect(base.width).toBeGreaterThan(0);
        expect(decodePngSize(base.data)).toEqual({ width: base.width, height: base.height });
        expect(scaled.width).toBe(base.width * 2);
        expect(scaled.height).toBe(base.height * 2);
        expect(decodePngSize(scaled.data)).toEqual({ width: scaled.width, height: scaled.height });
    });

    it("writes the PNG to the requested file, creating missing directories", async () => {
        const { container } = await render(<GtkLabel>Saved</GtkLabel>);
        const directory = mkdtempSync(join(tmpdir(), "gtkx-screenshots-"));
        const path = join(directory, "nested", "shot.png");
        const result = await screenshot(container, { path });
        expect(readFileSync(path).toString("base64")).toBe(result.data);
    });

    it("composites an open popover in and clips one that spills outside the captured widget", async () => {
        const popoverRef = createRef<Gtk.Popover>();
        const window = await renderMenuButton(popoverRef);
        const button = await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON);
        const closedWindow = await screenshot(window);
        const closedButton = await screenshot(button);
        const reread = await screenshot(window);
        expect(reread.data).toBe(closedWindow.data);
        await settle(() => popoverRef.current?.popup());
        expect(popoverRef.current?.getMapped()).toBe(true);
        const openedWindow = await screenshot(window);
        const openedButton = await screenshot(button);
        expect(openedWindow.data).not.toBe(closedWindow.data);
        expect(openedButton.width).toBe(closedButton.width);
        expect(openedButton.height).toBe(closedButton.height);
        await settle(() => popoverRef.current?.popdown());
        await waitFor(() => {
            expect(popoverRef.current?.getMapped()).toBe(false);
        });
        await clearHover(button);
        const reclosed = await screenshot(window);
        expect(reclosed.data).toBe(closedWindow.data);
    });

    it("captures content the compositor never presented", async () => {
        const { rerender } = await render(
            <GtkBox>
                <GtkLabel>Before the reload</GtkLabel>
            </GtkBox>,
        );

        const window = firstWindow();
        const presented = await screenshot(window);
        stopPresenting(window);

        await rerender(
            <GtkBox>
                <GtkLabel>After the reload, with much longer text</GtkLabel>
            </GtkBox>,
        );

        await wait(SETTLE_MS);
        const reloaded = await screenshot(window, { timeout: 1000 });

        await rerender(
            <GtkBox>
                <GtkLabel>Before the reload</GtkLabel>
            </GtkBox>,
        );

        await wait(SETTLE_MS);
        const reverted = await screenshot(window, { timeout: 1000 });
        expect(reloaded.width).toBe(presented.width);
        expect(reloaded.height).toBe(presented.height);
        expect(reloaded.data).not.toBe(reverted.data);
    });

    it("throws for a non-positive scale, an unpresented window and a widget with nothing painted", async () => {
        const boxRef = createRef<Gtk.Box>();
        const { container } = await render(<GtkBox ref={boxRef} widthRequest={40} heightRequest={20} />);
        await expect(screenshot(container, { scale: 0 })).rejects.toThrow();
        await expect(screenshot(widgetFor(boxRef), { timeout: 600 })).rejects.toThrow();
        const window = new Gtk.Window({ defaultWidth: 120, defaultHeight: 80 });
        window.setChild(new Gtk.Label({ label: "Never presented" }));
        window.realize();

        try {
            await expect(screenshot(window, { timeout: 5000 })).rejects.toThrow();
        } finally {
            window.destroy();
        }
    });
});

describe("screen.screenshot", () => {
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

        const foreground = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "Foreground", as: Gtk.Window });

        await act(() => {
            foreground.present();
        });

        const background = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "Background", as: Gtk.Window });
        const captured = await screen.screenshot();
        const direct = await screenshot(foreground);
        expect(captured.data).toBe(direct.data);
        const behind = await screenshot(background);
        expect(captured.data).not.toBe(behind.data);
    });

    it("throws once every toplevel is hidden", async () => {
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

        await expect(screen.screenshot()).rejects.toThrow();
    });
});
