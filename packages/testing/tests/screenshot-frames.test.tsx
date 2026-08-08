import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { render, screenshot } from "../src/index.js";

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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

const failureFor = async (widget: Gtk.Widget, timeout: number): Promise<string> => {
    try {
        await screenshot(widget, { timeout });
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }

    throw new Error("Expected the screenshot to fail");
};

describe("screenshot without a presented frame", () => {
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

        await wait(300);
        const reloaded = await screenshot(window, { timeout: 1000 });

        await rerender(
            <GtkBox>
                <GtkLabel>Before the reload</GtkLabel>
            </GtkBox>,
        );

        await wait(300);
        const reverted = await screenshot(window, { timeout: 1000 });
        const scaled = await screenshot(window, { scale: 2, timeout: 1000 });
        expect(reloaded.width).toBe(presented.width);
        expect(reloaded.height).toBe(presented.height);
        expect(reloaded.data).not.toBe(reverted.data);
        expect(scaled.width).toBe(presented.width * 2);
        expect(scaled.height).toBe(presented.height * 2);
    });
});

describe("screenshot failure diagnosis", () => {
    it("blames the display when no frames reach the window", async () => {
        const window = new Gtk.Window({ defaultWidth: 120, defaultHeight: 80 });
        window.setChild(new Gtk.Label({ label: "Never presented" }));
        window.realize();
        const startedAt = Date.now();

        try {
            const message = await failureFor(window, 5000);
            expect(message).toMatch(/display is not presenting frames to this window/);
            expect(message).not.toMatch(/the widget itself is empty/);
            expect(Date.now() - startedAt).toBeLessThan(1500);
        } finally {
            window.destroy();
        }
    });

    it("blames the widget when the display is presenting but nothing is painted", async () => {
        const boxRef = createRef<Gtk.Box>();
        await render(<GtkBox ref={boxRef} widthRequest={40} heightRequest={20} />);
        const message = await failureFor(widgetFor(boxRef), 600);
        expect(message).toMatch(/the widget itself is empty/);
        expect(message).not.toMatch(/display is not presenting frames/);
    });

    it("keeps other capture failures distinct from both", async () => {
        const labelRef = createRef<Gtk.Label>();

        await render(
            <GtkBox>
                <GtkLabel ref={labelRef} visible={false}>
                    Hidden
                </GtkLabel>
            </GtkBox>,
        );

        const message = await failureFor(widgetFor(labelRef), 600);
        expect(message).toMatch(/Widget has no size/);
        expect(message).toMatch(/the capture failed for another reason/);
        expect(message).not.toMatch(/display is not presenting frames/);
    });
});
