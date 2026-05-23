import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import { GtkFontDialogButton } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - FontDialogButton > FontDialogButtonNode (1)", () => {
    it("creates FontDialogButton widget", async () => {
        const ref = createRef<Gtk.FontDialogButton>();

        await render(<GtkFontDialogButton ref={ref} />);

        expect(ref.current?.getDialog()).not.toBeNull();
        expect(ref.current?.getLevel()).toBe(Gtk.FontLevel.FONT);
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

describe("render - FontDialogButton > FontDialogButtonNode (2)", () => {
    it("sets dialog title", async () => {
        const ref = createRef<Gtk.FontDialogButton>();

        await render(<GtkFontDialogButton ref={ref} title="Select Font" />);

        expect(ref.current).not.toBeNull();
        const dialog = ref.current?.getDialog();
        expect(dialog?.getTitle()).toBe("Select Font");
    });

    it("updates dialog title when prop changes", async () => {
        const ref = createRef<Gtk.FontDialogButton>();

        function App({ title }: { title: string }) {
            return <GtkFontDialogButton ref={ref} title={title} />;
        }

        await render(<App title="First Title" />);
        expect(ref.current?.getDialog()?.getTitle()).toBe("First Title");

        await render(<App title="Second Title" />);
        expect(ref.current?.getDialog()?.getTitle()).toBe("Second Title");
    });

    it("sets dialog modal property", async () => {
        const ref = createRef<Gtk.FontDialogButton>();

        await render(<GtkFontDialogButton ref={ref} modal={false} />);

        expect(ref.current).not.toBeNull();
        const dialog = ref.current?.getDialog();
        expect(dialog?.getModal()).toBe(false);
    });

    it("sets useFont property", async () => {
        const ref = createRef<Gtk.FontDialogButton>();

        await render(<GtkFontDialogButton ref={ref} useFont={true} />);

        expect(ref.current).not.toBeNull();
        expect(ref.current?.getUseFont()).toBe(true);
    });
});

describe("render - FontDialogButton > FontDialogButtonNode (3)", () => {
    it("updates useFont when prop changes", async () => {
        const ref = createRef<Gtk.FontDialogButton>();

        function App({ useFont }: { useFont: boolean }) {
            return <GtkFontDialogButton ref={ref} useFont={useFont} />;
        }

        await render(<App useFont={false} />);
        expect(ref.current?.getUseFont()).toBe(false);

        await render(<App useFont={true} />);
        expect(ref.current?.getUseFont()).toBe(true);
    });

    it("sets useSize property", async () => {
        const ref = createRef<Gtk.FontDialogButton>();

        await render(<GtkFontDialogButton ref={ref} useSize={true} />);

        expect(ref.current).not.toBeNull();
        expect(ref.current?.getUseSize()).toBe(true);
    });

    it("updates useSize when prop changes", async () => {
        const ref = createRef<Gtk.FontDialogButton>();

        function App({ useSize }: { useSize: boolean }) {
            return <GtkFontDialogButton ref={ref} useSize={useSize} />;
        }

        await render(<App useSize={false} />);
        expect(ref.current?.getUseSize()).toBe(false);

        await render(<App useSize={true} />);
        expect(ref.current?.getUseSize()).toBe(true);
    });

    it("sets level property", async () => {
        const ref = createRef<Gtk.FontDialogButton>();

        await render(<GtkFontDialogButton ref={ref} level={Gtk.FontLevel.FAMILY} />);

        expect(ref.current).not.toBeNull();
        expect(ref.current?.getLevel()).toBe(Gtk.FontLevel.FAMILY);
    });
});

describe("render - FontDialogButton > FontDialogButtonNode (4)", () => {
    it("updates level when prop changes", async () => {
        const ref = createRef<Gtk.FontDialogButton>();

        function App({ level }: { level: Gtk.FontLevel }) {
            return <GtkFontDialogButton ref={ref} level={level} />;
        }

        await render(<App level={Gtk.FontLevel.FONT} />);
        expect(ref.current?.getLevel()).toBe(Gtk.FontLevel.FONT);

        await render(<App level={Gtk.FontLevel.FEATURES} />);
        expect(ref.current?.getLevel()).toBe(Gtk.FontLevel.FEATURES);
    });
});
