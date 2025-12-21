import * as Gtk from "@gtkx/ffi/gtk";
import { GtkAboutDialog, GtkBox } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - AboutDialog", () => {
    it("creates AboutDialog widget", async () => {
        const ref = createRef<Gtk.AboutDialog>();

        await render(<GtkAboutDialog ref={ref} programName="Test App" />, { wrapper: false });

        expect(ref.current).not.toBeNull();
    });

    it("does not attach to parent widget tree", async () => {
        const boxRef = createRef<Gtk.Box>();
        const dialogRef = createRef<Gtk.AboutDialog>();

        await render(
            <GtkBox ref={boxRef} spacing={0} orientation={Gtk.Orientation.VERTICAL}>
                <GtkAboutDialog ref={dialogRef} programName="Dialog" />
            </GtkBox>,
            { wrapper: false },
        );

        expect(dialogRef.current?.getParent()).toBeNull();
    });

    it("presents on mount", async () => {
        const ref = createRef<Gtk.AboutDialog>();

        await render(<GtkAboutDialog ref={ref} programName="Mount Test" />, { wrapper: false });

        expect(ref.current?.getVisible()).toBe(true);
    });

    it("destroys on unmount", async () => {
        const ref = createRef<Gtk.AboutDialog>();

        function App({ show }: { show: boolean }) {
            return show ? <GtkAboutDialog ref={ref} programName="Unmount Test" /> : null;
        }

        await render(<App show={true} />, { wrapper: false });

        const dialogId = ref.current?.id;
        expect(dialogId).toBeDefined();

        await render(<App show={false} />, { wrapper: false });
    });

    it("sets dialog properties (programName, version, etc.)", async () => {
        const ref = createRef<Gtk.AboutDialog>();

        await render(
            <GtkAboutDialog
                ref={ref}
                programName="My Application"
                version="1.0.0"
                copyright="Copyright 2024"
                comments="A test application"
                website="https://example.com"
            />,
            { wrapper: false },
        );

        expect(ref.current?.getProgramName()).toBe("My Application");
        expect(ref.current?.getVersion()).toBe("1.0.0");
        expect(ref.current?.getCopyright()).toBe("Copyright 2024");
        expect(ref.current?.getComments()).toBe("A test application");
        expect(ref.current?.getWebsite()).toBe("https://example.com");
    });
});
