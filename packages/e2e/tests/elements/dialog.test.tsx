import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { act, render } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { createAppIdFactory } from "../helpers/unique-name.js";

const uniqueAppId = createAppIdFactory("org.gtkx.dialogtest");

const requireDialog = (ref: RefObject<Adw.AlertDialog | null>): Adw.AlertDialog => {
    const dialog = ref.current;

    if (!dialog) {
        throw new Error("Dialog ref was not populated");
    }

    return dialog;
};

const InApp = ({ children }: { children: ReactNode }) => {
    const [appId] = useState(uniqueAppId);

    return (
        <GtkApplication applicationId={appId} flags={Gio.ApplicationFlags.NON_UNIQUE}>
            <GtkApplicationWindow defaultWidth={100} defaultHeight={100}>
                {children}
            </GtkApplicationWindow>
        </GtkApplication>
    );
};

describe("Dialog - render prop and lifecycle", () => {
    it("attaches the provided ref to the dialog widget and presents it", async () => {
        const dialogRef = createRef<Adw.AlertDialog>();

        await render(
            <InApp>
                <AdwAlertDialog
                    ref={(widget) => {
                        dialogRef.current = widget;
                    }}
                    heading="Presented"
                />
            </InApp>,
        );

        const dialog = requireDialog(dialogRef);
        expect(dialog).toBeInstanceOf(Adw.Dialog);
        expect(dialog.getRoot()).toBeInstanceOf(Gtk.Window);
    });

    it("fires onClose when the user closes the dialog", async () => {
        const dialogRef = createRef<Adw.AlertDialog>();
        const onClose = vi.fn();

        await render(
            <InApp>
                <AdwAlertDialog
                    onClosed={onClose}
                    ref={(widget) => {
                        dialogRef.current = widget;
                    }}
                    heading="Closable"
                />
            </InApp>,
        );

        await act(() => {
            requireDialog(dialogRef).emit("closed");
        });

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not fire onClose when React unmounts the dialog", async () => {
        const onClose = vi.fn();

        const App = ({ open }: { open: boolean }) => (
            <InApp>{open ? <AdwAlertDialog onClosed={onClose} heading="Unmounted" /> : null}</InApp>
        );

        const { rerender } = await render(<App open={true} />);
        await rerender(<App open={false} />);
        expect(onClose).not.toHaveBeenCalled();
    });
});
