import * as Gtk from "@gtkx/gi/gtk";
import { GtkAdjustment, GtkBox, GtkButton, GtkLabel, GtkScale, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, userEvent, waitFor } from "../src/index.js";

describe("userEvent.slide", () => {
    it("sets a Gtk.Scale to an exact value through its change-value signal", async () => {
        await render(
            <GtkScale
                adjustment={<GtkAdjustment value={10} lower={0} upper={100} stepIncrement={1} pageIncrement={10} />}
            />,
        );
        const scale = (await screen.findByRole(Gtk.AccessibleRole.SLIDER)) as Gtk.Scale;

        await userEvent.slide(scale, 45);
        expect(scale.getValue()).toBe(45);

        await userEvent.slide(scale, 999);
        expect(scale.getValue()).toBe(100);
    });

    it("throws when the target is not a Gtk.Range", async () => {
        await render(<GtkButton label="nope" />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "nope" });
        await expect(userEvent.slide(button, 5)).rejects.toThrow(/requires a Gtk.Range/);
    });
});

describe("userEvent.scroll", () => {
    it("drives a Gtk.ScrolledWindow's adjustments, including from a descendant", async () => {
        const ref = createRef<Gtk.ScrolledWindow>();
        await render(
            <GtkScrolledWindow ref={ref} minContentHeight={200}>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} heightRequest={2000} widthRequest={2000}>
                    <GtkLabel label="top" />
                </GtkBox>
            </GtkScrolledWindow>,
        );
        const sw = ref.current;
        expect(sw).not.toBeNull();
        const vadjustment = (sw as Gtk.ScrolledWindow).getVadjustment();
        await waitFor(() => expect(vadjustment.getUpper()).toBeGreaterThan(vadjustment.getPageSize()));

        await userEvent.scroll(sw as Gtk.ScrolledWindow, { y: 100 });
        expect(vadjustment.getValue()).toBe(100);

        await userEvent.scroll(await screen.findByText("top"), { y: 50 });
        expect(vadjustment.getValue()).toBe(150);

        await userEvent.scroll(sw as Gtk.ScrolledWindow, { x: 40 });
        expect((sw as Gtk.ScrolledWindow).getHadjustment().getValue()).toBe(40);
    });

    it("throws when there is no scrollable ancestor", async () => {
        await render(<GtkButton label="plain" />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "plain" });
        await expect(userEvent.scroll(button, { y: 10 })).rejects.toThrow(/no Gtk.ScrolledWindow or Gtk.Scrollable/);
    });
});

describe("userEvent.drag", () => {
    it("refuses to silently no-op on a built-in Gtk.Range slider", async () => {
        await render(<GtkScale adjustment={<GtkAdjustment value={0} lower={0} upper={100} />} />);
        const scale = (await screen.findByRole(Gtk.AccessibleRole.SLIDER)) as Gtk.Scale;
        await expect(userEvent.drag(scale, 50, 0)).rejects.toThrow(/userEvent.slide/);
    });
});
