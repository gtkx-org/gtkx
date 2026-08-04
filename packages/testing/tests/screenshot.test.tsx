import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel, GtkMenuButton, GtkPopover } from "@gtkx/jsx/gtk";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { act, render, screen, screenshot } from "../src/index.js";
import { decodePngSize } from "./png-helpers.js";

const renderMenuButton = async (popoverRef: RefObject<Gtk.Popover | null>): Promise<void> => {
    await render(
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkMenuButton label="Open">
                <GtkPopover ref={popoverRef}>
                    <GtkLabel>Inside the popover</GtkLabel>
                </GtkPopover>
            </GtkMenuButton>
        </GtkBox>,
    );
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
        await renderMenuButton(popoverRef);
        const closed = await screen.screenshot();
        await settle(() => popoverRef.current?.popup());
        expect(popoverRef.current?.getMapped()).toBe(true);
        const opened = await screen.screenshot();
        await settle(() => popoverRef.current?.popdown());
        const reclosed = await screen.screenshot();
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
        await renderMenuButton(popoverRef);
        const first = await screen.screenshot();
        const second = await screen.screenshot();
        expect(popoverRef.current?.getMapped()).toBe(false);
        expect(second.data).toBe(first.data);
    });
});
