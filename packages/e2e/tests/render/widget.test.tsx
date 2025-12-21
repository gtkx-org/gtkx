import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkEntry, GtkImage, GtkLabel } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - widget creation", () => {
    describe("basic widgets", () => {
        it("creates Label widget with text", async () => {
            const ref = createRef<Gtk.Label>();

            await render(<GtkLabel ref={ref} label="Hello World" />, { wrapper: false });

            expect(ref.current).not.toBeNull();
            expect(ref.current?.getLabel()).toBe("Hello World");
        });

        it("creates Button widget with label", async () => {
            const ref = createRef<Gtk.Button>();

            await render(<GtkButton ref={ref} label="Click Me" />, { wrapper: false });

            expect(ref.current).not.toBeNull();
            expect(ref.current?.getLabel()).toBe("Click Me");
        });

        it("creates Box widget with orientation", async () => {
            const ref = createRef<Gtk.Box>();

            await render(<GtkBox ref={ref} spacing={0} orientation={Gtk.Orientation.VERTICAL} />, { wrapper: false });

            expect(ref.current).not.toBeNull();
            expect(ref.current?.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        });

        it("creates Entry widget", async () => {
            const ref = createRef<Gtk.Entry>();

            await render(<GtkEntry ref={ref} placeholderText="Enter text" />, { wrapper: false });

            expect(ref.current).not.toBeNull();
            expect(ref.current?.getPlaceholderText()).toBe("Enter text");
        });

        it("creates Image widget", async () => {
            const ref = createRef<Gtk.Image>();

            await render(<GtkImage ref={ref} iconName="dialog-information" />, { wrapper: false });

            expect(ref.current).not.toBeNull();
            expect(ref.current?.getIconName()).toBe("dialog-information");
        });
    });

    describe("constructor parameters", () => {
        it("passes constructor parameters from props", async () => {
            const ref = createRef<Gtk.Box>();

            await render(<GtkBox ref={ref} orientation={Gtk.Orientation.HORIZONTAL} spacing={10} />, {
                wrapper: false,
            });

            expect(ref.current?.getSpacing()).toBe(10);
        });

        it("handles widgets with no constructor parameters", async () => {
            const ref = createRef<Gtk.Button>();

            await render(<GtkButton ref={ref} />, { wrapper: false });

            expect(ref.current).not.toBeNull();
        });

        it("handles widgets with optional constructor parameters", async () => {
            const ref = createRef<Gtk.Label>();

            await render(<GtkLabel ref={ref} />, { wrapper: false });

            expect(ref.current).not.toBeNull();
        });
    });

    describe("ref access", () => {
        it("provides GTK widget via ref", async () => {
            const ref = createRef<Gtk.Label>();

            await render(<GtkLabel ref={ref} label="Test" />, { wrapper: false });

            expect(ref.current).not.toBeNull();
            expect(typeof ref.current?.getLabel).toBe("function");
        });

        it("ref.current is the actual GTK widget instance", async () => {
            const ref = createRef<Gtk.Label>();

            await render(<GtkLabel ref={ref} label="Widget Instance" />, { wrapper: false });

            expect(ref.current?.id).toBeDefined();
            expect(ref.current?.getLabel()).toBe("Widget Instance");
        });
    });
});
