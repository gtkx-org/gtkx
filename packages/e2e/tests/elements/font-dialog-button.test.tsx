import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { GtkFontDialog, GtkFontDialogButton } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { expectDialogModalProp, expectDialogTitleTracksProp } from "../helpers/dialog-button-render.js";

describe("render - FontDialogButton (1)", () => {
    it("creates FontDialogButton widget", async () => {
        const ref = createRef<Gtk.FontDialogButton>();
        await render(<GtkFontDialogButton ref={ref} dialog={<GtkFontDialog />} />);
        expect(ref.current?.getDialog()).not.toBeNull();
        expect(ref.current).toHaveObjectProperty("level", Gtk.FontLevel.FONT);
    });

    it("creates FontDialogButton with initial fontDesc", async () => {
        const ref = createRef<Gtk.FontDialogButton>();
        const fontDesc = Pango.FontDescription.fromString("Sans Bold 12");
        await render(<GtkFontDialogButton ref={ref} fontDesc={fontDesc} />);
        expect(ref.current).not.toBeNull();
        const currentFontDesc = ref.current?.getFontDesc();
        expect(currentFontDesc?.toString()).toBe("Sans Bold 12");
    });

    it("updates fontDesc when prop changes", async () => {
        const ref = createRef<Gtk.FontDialogButton>();

        function App({ font }: { font: Pango.FontDescription }) {
            return <GtkFontDialogButton ref={ref} fontDesc={font} />;
        }

        const initialFont = Pango.FontDescription.fromString("Sans 10");
        await render(<App font={initialFont} />);
        const fontDesc1 = ref.current?.getFontDesc();
        expect(fontDesc1?.toString()).toBe("Sans 10");
        const newFont = Pango.FontDescription.fromString("Serif Bold 14");
        await render(<App font={newFont} />);
        const fontDesc2 = ref.current?.getFontDesc();
        expect(fontDesc2?.toString()).toBe("Serif Bold 14");
    });
});

describe("render - FontDialogButton (2)", () => {
    it("sets dialog title", async () => {
        const ref = createRef<Gtk.FontDialogButton>();
        await render(<GtkFontDialogButton ref={ref} dialog={<GtkFontDialog title="Select Font" />} />);
        expect(ref.current).not.toBeNull();
        const dialog = ref.current?.getDialog();
        expect(dialog).toHaveObjectProperty("title", "Select Font");
    });

    it("updates dialog title when the slot element changes", async () => {
        await expectDialogTitleTracksProp<Gtk.FontDialogButton>((ref, dialogProps) => (
            <GtkFontDialogButton ref={ref} dialog={<GtkFontDialog {...dialogProps} />} />
        ));
    });

    it("sets dialog modal property", async () => {
        await expectDialogModalProp<Gtk.FontDialogButton>((ref, dialogProps) => (
            <GtkFontDialogButton ref={ref} dialog={<GtkFontDialog {...dialogProps} />} />
        ));
    });

    it("sets useFont property", async () => {
        const ref = createRef<Gtk.FontDialogButton>();
        await render(<GtkFontDialogButton ref={ref} useFont={true} />);
        expect(ref.current).not.toBeNull();
        expect(ref.current).toHaveObjectProperty("useFont", true);
    });
});

describe("render - FontDialogButton (3)", () => {
    it("updates useFont when prop changes", async () => {
        const ref = createRef<Gtk.FontDialogButton>();

        function App({ useFont }: { useFont: boolean }) {
            return <GtkFontDialogButton ref={ref} useFont={useFont} />;
        }

        await render(<App useFont={false} />);
        expect(ref.current).toHaveObjectProperty("useFont", false);
        await render(<App useFont={true} />);
        expect(ref.current).toHaveObjectProperty("useFont", true);
    });

    it("sets useSize property", async () => {
        const ref = createRef<Gtk.FontDialogButton>();
        await render(<GtkFontDialogButton ref={ref} useSize={true} />);
        expect(ref.current).not.toBeNull();
        expect(ref.current).toHaveObjectProperty("useSize", true);
    });

    it("updates useSize when prop changes", async () => {
        const ref = createRef<Gtk.FontDialogButton>();

        function App({ useSize }: { useSize: boolean }) {
            return <GtkFontDialogButton ref={ref} useSize={useSize} />;
        }

        await render(<App useSize={false} />);
        expect(ref.current).toHaveObjectProperty("useSize", false);
        await render(<App useSize={true} />);
        expect(ref.current).toHaveObjectProperty("useSize", true);
    });

    it("sets level property", async () => {
        const ref = createRef<Gtk.FontDialogButton>();
        await render(<GtkFontDialogButton ref={ref} level={Gtk.FontLevel.FAMILY} />);
        expect(ref.current).not.toBeNull();
        expect(ref.current).toHaveObjectProperty("level", Gtk.FontLevel.FAMILY);
    });
});

describe("render - FontDialogButton (4)", () => {
    it("updates level when prop changes", async () => {
        const ref = createRef<Gtk.FontDialogButton>();

        function App({ level }: { level: Gtk.FontLevel }) {
            return <GtkFontDialogButton ref={ref} level={level} />;
        }

        await render(<App level={Gtk.FontLevel.FONT} />);
        expect(ref.current).toHaveObjectProperty("level", Gtk.FontLevel.FONT);
        await render(<App level={Gtk.FontLevel.FEATURES} />);
        expect(ref.current).toHaveObjectProperty("level", Gtk.FontLevel.FEATURES);
    });
});
