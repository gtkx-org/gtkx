import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkToggleButton } from "@gtkx/react";
import { fireEvent, render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

describe("render - ToggleButton", () => {
    it("creates ToggleButton widget", async () => {
        const ref = createRef<Gtk.ToggleButton>();

        await render(<GtkToggleButton.Root ref={ref} label="Toggle" />, { wrapper: false });

        expect(ref.current).not.toBeNull();
    });

    it("sets active state via active prop", async () => {
        const ref = createRef<Gtk.ToggleButton>();

        await render(<GtkToggleButton.Root ref={ref} active={true} label="Active" />, { wrapper: false });

        expect(ref.current?.getActive()).toBe(true);
    });

    it("updates active state when prop changes", async () => {
        const ref = createRef<Gtk.ToggleButton>();

        function App({ active }: { active: boolean }) {
            return <GtkToggleButton.Root ref={ref} active={active} label="Toggle" />;
        }

        await render(<App active={false} />, { wrapper: false });

        expect(ref.current?.getActive()).toBe(false);

        await render(<App active={true} />, { wrapper: false });

        expect(ref.current?.getActive()).toBe(true);
    });

    it("calls onToggled when toggled", async () => {
        const ref = createRef<Gtk.ToggleButton>();
        const onToggled = vi.fn();

        await render(<GtkToggleButton.Root ref={ref} onToggled={onToggled} label="Toggle" />, { wrapper: false });

        await fireEvent(ref.current as Gtk.Widget, "toggled");

        expect(onToggled).toHaveBeenCalledTimes(1);
    });
});
