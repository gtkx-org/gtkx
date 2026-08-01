import type * as Gtk from "@gtkx/gi/gtk";
import * as Gdk from "@gtkx/gi/gdk";
import { GtkColorDialog, GtkColorDialogButton } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { expectDialogModalProp, expectDialogTitleTracksProp } from "../helpers/dialog-button-render.js";

const renderDialogSlot = async (dialog: ReactElement): Promise<Gtk.ColorDialog | null> => {
    const ref = createRef<Gtk.ColorDialogButton>();
    await render(<GtkColorDialogButton ref={ref} dialog={dialog} />);
    expect(ref.current).not.toBeNull();

    return ref.current?.getDialog() ?? null;
};

const makeRgba = (red: number, green: number, blue: number, alpha: number): Gdk.RGBA =>
    Object.assign(new Gdk.RGBA(), { red, green, blue, alpha });

describe("render - ColorDialogButton (1)", () => {
    it("creates ColorDialogButton widget", async () => {
        const dialog = await renderDialogSlot(<GtkColorDialog />);
        expect(dialog).not.toBeNull();
        expect(dialog).toHaveObjectProperty("withAlpha", true);
    });

    it("creates ColorDialogButton with initial rgba", async () => {
        const ref = createRef<Gtk.ColorDialogButton>();
        const rgba = makeRgba(1, 0.5, 0.25, 1);
        await render(<GtkColorDialogButton ref={ref} rgba={rgba} />);
        expect(ref.current).not.toBeNull();
        const currentRgba = ref.current?.getRgba();
        expect(currentRgba?.red).toBeCloseTo(1);
        expect(currentRgba?.green).toBeCloseTo(0.5);
        expect(currentRgba?.blue).toBeCloseTo(0.25);
        expect(currentRgba?.alpha).toBeCloseTo(1);
    });

    it("updates rgba when prop changes", async () => {
        const ref = createRef<Gtk.ColorDialogButton>();

        function App({ color }: { color: Gdk.RGBA }) {
            return <GtkColorDialogButton ref={ref} rgba={color} />;
        }

        const initialColor = makeRgba(1, 0, 0, 1);
        await render(<App color={initialColor} />);
        const rgba1 = ref.current?.getRgba();
        expect(rgba1?.red).toBeCloseTo(1);
        expect(rgba1?.green).toBeCloseTo(0);
        const newColor = makeRgba(0, 1, 0, 1);
        await render(<App color={newColor} />);
        const rgba2 = ref.current?.getRgba();
        expect(rgba2?.red).toBeCloseTo(0);
        expect(rgba2?.green).toBeCloseTo(1);
    });
});

describe("render - ColorDialogButton (2)", () => {
    it("sets dialog title", async () => {
        const dialog = await renderDialogSlot(<GtkColorDialog title="Pick a Color" />);
        expect(dialog).toHaveObjectProperty("title", "Pick a Color");
    });

    it("updates dialog title when the slot element changes", async () => {
        await expectDialogTitleTracksProp<Gtk.ColorDialogButton>((ref, dialogProps) => (
            <GtkColorDialogButton ref={ref} dialog={<GtkColorDialog {...dialogProps} />} />
        ));
    });

    it("sets dialog modal property", async () => {
        await expectDialogModalProp<Gtk.ColorDialogButton>((ref, dialogProps) => (
            <GtkColorDialogButton ref={ref} dialog={<GtkColorDialog {...dialogProps} />} />
        ));
    });

    it("sets dialog withAlpha property", async () => {
        const dialog = await renderDialogSlot(<GtkColorDialog withAlpha={false} />);
        expect(dialog).toHaveObjectProperty("withAlpha", false);
    });
});

describe("render - ColorDialogButton (3)", () => {
    it("updates withAlpha when the slot element changes", async () => {
        const ref = createRef<Gtk.ColorDialogButton>();

        function App({ hasAlpha }: { hasAlpha: boolean }) {
            return <GtkColorDialogButton ref={ref} dialog={<GtkColorDialog withAlpha={hasAlpha} />} />;
        }

        await render(<App hasAlpha={true} />);
        expect(ref.current?.getDialog()).toHaveObjectProperty("withAlpha", true);
        await render(<App hasAlpha={false} />);
        expect(ref.current?.getDialog()).toHaveObjectProperty("withAlpha", false);
    });
});
