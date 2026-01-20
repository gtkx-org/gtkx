import * as Gdk from "@gtkx/ffi/gdk";
import type * as Gtk from "@gtkx/ffi/gtk";
import { GtkColorDialogButton } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - ColorDialogButton", () => {
    describe("ColorDialogButtonNode", () => {
        it("creates ColorDialogButton widget", async () => {
            const ref = createRef<Gtk.ColorDialogButton>();

            await render(<GtkColorDialogButton ref={ref} />);

            expect(ref.current).not.toBeNull();
        });

        it("creates ColorDialogButton with initial rgba", async () => {
            const ref = createRef<Gtk.ColorDialogButton>();
            const rgba = new Gdk.RGBA({ red: 1.0, green: 0.5, blue: 0.25, alpha: 1.0 });

            await render(<GtkColorDialogButton ref={ref} rgba={rgba} />);

            expect(ref.current).not.toBeNull();
            const currentRgba = ref.current?.getRgba();
            expect(currentRgba?.getRed()).toBeCloseTo(1.0);
            expect(currentRgba?.getGreen()).toBeCloseTo(0.5);
            expect(currentRgba?.getBlue()).toBeCloseTo(0.25);
            expect(currentRgba?.getAlpha()).toBeCloseTo(1.0);
        });

        it("updates rgba when prop changes", async () => {
            const ref = createRef<Gtk.ColorDialogButton>();

            function App({ color }: { color: Gdk.RGBA }) {
                return <GtkColorDialogButton ref={ref} rgba={color} />;
            }

            const initialColor = new Gdk.RGBA({ red: 1.0, green: 0.0, blue: 0.0, alpha: 1.0 });
            await render(<App color={initialColor} />);

            const rgba1 = ref.current?.getRgba();
            expect(rgba1?.getRed()).toBeCloseTo(1.0);
            expect(rgba1?.getGreen()).toBeCloseTo(0.0);

            const newColor = new Gdk.RGBA({ red: 0.0, green: 1.0, blue: 0.0, alpha: 1.0 });
            await render(<App color={newColor} />);

            const rgba2 = ref.current?.getRgba();
            expect(rgba2?.getRed()).toBeCloseTo(0.0);
            expect(rgba2?.getGreen()).toBeCloseTo(1.0);
        });

        it("sets dialog title", async () => {
            const ref = createRef<Gtk.ColorDialogButton>();

            await render(<GtkColorDialogButton ref={ref} title="Pick a Color" />);

            expect(ref.current).not.toBeNull();
            const dialog = ref.current?.getDialog();
            expect(dialog?.getTitle()).toBe("Pick a Color");
        });

        it("updates dialog title when prop changes", async () => {
            const ref = createRef<Gtk.ColorDialogButton>();

            function App({ title }: { title: string }) {
                return <GtkColorDialogButton ref={ref} title={title} />;
            }

            await render(<App title="First Title" />);
            expect(ref.current?.getDialog()?.getTitle()).toBe("First Title");

            await render(<App title="Second Title" />);
            expect(ref.current?.getDialog()?.getTitle()).toBe("Second Title");
        });

        it("sets dialog modal property", async () => {
            const ref = createRef<Gtk.ColorDialogButton>();

            await render(<GtkColorDialogButton ref={ref} modal={false} />);

            expect(ref.current).not.toBeNull();
            const dialog = ref.current?.getDialog();
            expect(dialog?.getModal()).toBe(false);
        });

        it("sets dialog withAlpha property", async () => {
            const ref = createRef<Gtk.ColorDialogButton>();

            await render(<GtkColorDialogButton ref={ref} withAlpha={false} />);

            expect(ref.current).not.toBeNull();
            const dialog = ref.current?.getDialog();
            expect(dialog?.getWithAlpha()).toBe(false);
        });

        it("updates withAlpha when prop changes", async () => {
            const ref = createRef<Gtk.ColorDialogButton>();

            function App({ withAlpha }: { withAlpha: boolean }) {
                return <GtkColorDialogButton ref={ref} withAlpha={withAlpha} />;
            }

            await render(<App withAlpha={true} />);
            expect(ref.current?.getDialog()?.getWithAlpha()).toBe(true);

            await render(<App withAlpha={false} />);
            expect(ref.current?.getDialog()?.getWithAlpha()).toBe(false);
        });
    });
});
