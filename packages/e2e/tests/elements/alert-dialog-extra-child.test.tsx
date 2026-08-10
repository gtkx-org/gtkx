import type * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwAlertDialog, AdwDialog } from "@gtkx/jsx/adw";
import { GtkApplication, GtkApplicationWindow, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, waitFor, within } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject, useState } from "react";
import { describe, expect, it } from "vitest";
import { createAppIdFactory } from "../helpers/unique-name.js";

type AlertResponse = { id: string; label: string };
type AlertRef = RefObject<Adw.AlertDialog | null>;

const uniqueAppId = createAppIdFactory("org.gtkx.alertextrachild");
const RESPONSES: AlertResponse[] = [{ id: "cancel", label: "Cancel" }, { id: "ok", label: "OK" }];
const HEADING = "Alert heading";

const requireWidget = <T extends Gtk.Widget>(ref: RefObject<T | null>, label: string): T => {
    const widget = ref.current;

    if (!widget) {
        throw new Error(`${label} ref was not populated`);
    }

    return widget;
};

const InApp = ({ children }: { children: ReactNode }) => {
    const [appId] = useState(uniqueAppId);

    return (
        <GtkApplication applicationId={appId} flags={Gio.ApplicationFlags.NON_UNIQUE}>
            <GtkApplicationWindow defaultWidth={200} defaultHeight={200}>
                {children}
            </GtkApplicationWindow>
        </GtkApplication>
    );
};

const alertDialog = (ref: AlertRef, children?: ReactNode) => (
    <AdwAlertDialog ref={ref} heading={HEADING} responses={RESPONSES}>
        {children}
    </AdwAlertDialog>
);

const ToggledAlert = ({ dialogRef, isOpen }: { dialogRef: AlertRef; isOpen: boolean }) => (
    <InApp>{isOpen ? alertDialog(dialogRef, <GtkLabel>Extra content</GtkLabel>) : null}</InApp>
);

const SwappedAlert = ({ dialogRef, isButton }: { dialogRef: AlertRef; isButton: boolean }) => (
    <InApp>{alertDialog(dialogRef, isButton ? <GtkButton label="Second" /> : <GtkLabel>First</GtkLabel>)}</InApp>
);

const OptionalChildAlert = ({ dialogRef, hasChildren }: { dialogRef: AlertRef; hasChildren: boolean }) => (
    <InApp>{alertDialog(dialogRef, hasChildren ? <GtkLabel>Extra content</GtkLabel> : null)}</InApp>
);

const renderAlertDialog = async (children?: ReactNode): Promise<Adw.AlertDialog> => {
    const ref = createRef<Adw.AlertDialog>();
    await render(<InApp>{alertDialog(ref, children)}</InApp>);

    return requireWidget(ref, "Alert dialog");
};

const expectButton = async (dialog: Adw.AlertDialog, name: string): Promise<void> => {
    const button = await within(dialog).findByRole(Gtk.AccessibleRole.BUTTON, { name, hidden: true });
    expect(button).toBeInstanceOf(Gtk.Button);
};

describe("AlertDialog extra child (1)", () => {
    it("exposes its response buttons when it has no children", async () => {
        const dialog = await renderAlertDialog();
        expect(dialog.hasResponse("cancel")).toBe(true);
        expect(dialog.hasResponse("ok")).toBe(true);
        expect(dialog.getExtraChild()).toBeNull();
        await expectButton(dialog, "Cancel");
        await expectButton(dialog, "OK");
    });

    it("keeps its heading and response buttons when it has children", async () => {
        const dialog = await renderAlertDialog(<GtkLabel>Extra content</GtkLabel>);
        expect(dialog.hasResponse("cancel")).toBe(true);
        expect(dialog.hasResponse("ok")).toBe(true);
        expect(dialog.getHeading()).toBe(HEADING);
        expect(within(dialog).getByText(HEADING)).toBeInstanceOf(Gtk.Label);
        await expectButton(dialog, "Cancel");
        await expectButton(dialog, "OK");
    });

    it("routes its children to the extra child rather than the dialog child", async () => {
        const dialog = await renderAlertDialog(<GtkLabel>Extra content</GtkLabel>);
        const extraChild = dialog.getExtraChild();
        expect(extraChild).toBeInstanceOf(Gtk.Label);
        expect(dialog.getChild()).not.toBe(extraChild);
        expect(within(dialog).getByText("Extra content")).toBe(extraChild);
    });
});

describe("AlertDialog extra child (2)", () => {
    it("clears the extra child and closes when React unmounts the dialog", async () => {
        const ref = createRef<Adw.AlertDialog>();
        const { rerender } = await render(<ToggledAlert dialogRef={ref} isOpen={true} />);
        expect(screen.getByText("Extra content")).toBeInstanceOf(Gtk.Label);
        await rerender(<ToggledAlert dialogRef={ref} isOpen={false} />);

        await waitFor(() => {
            expect(screen.queryByText("Extra content")).toBeNull();
            expect(screen.queryByText(HEADING)).toBeNull();
        });
    });

    it("swaps the extra child when the child element type changes", async () => {
        const ref = createRef<Adw.AlertDialog>();
        const { rerender } = await render(<SwappedAlert dialogRef={ref} isButton={false} />);
        const dialog = requireWidget(ref, "Alert dialog");
        const first = dialog.getExtraChild();
        expect(first).toBeInstanceOf(Gtk.Label);
        expect(within(dialog).getByText("First")).toBe(first);
        await rerender(<SwappedAlert dialogRef={ref} isButton={true} />);
        const second = dialog.getExtraChild();
        expect(second).toBeInstanceOf(Gtk.Button);
        expect(second).not.toBe(first);
        expect(within(dialog).queryByText("First")).toBeNull();
        expect(within(dialog).getByText(HEADING)).toBeInstanceOf(Gtk.Label);
        expect(dialog.hasResponse("ok")).toBe(true);
    });
});

describe("AlertDialog extra child (3)", () => {
    it("clears the extra child when the children go away and restores it when they return", async () => {
        const ref = createRef<Adw.AlertDialog>();
        const { rerender } = await render(<OptionalChildAlert dialogRef={ref} hasChildren={true} />);
        const dialog = requireWidget(ref, "Alert dialog");
        expect(dialog.getExtraChild()).toBeInstanceOf(Gtk.Label);
        await rerender(<OptionalChildAlert dialogRef={ref} hasChildren={false} />);
        expect(dialog.getExtraChild()).toBeNull();
        expect(within(dialog).getByText(HEADING)).toBeInstanceOf(Gtk.Label);
        await expectButton(dialog, "OK");
        await rerender(<OptionalChildAlert dialogRef={ref} hasChildren={true} />);
        expect(within(dialog).getByText("Extra content")).toBe(dialog.getExtraChild());
    });

    it("leaves a plain AdwDialog setting its child from its children", async () => {
        const ref = createRef<Adw.Dialog>();

        await render(
            <InApp>
                <AdwDialog ref={ref} title="Plain">
                    <GtkLabel>Plain content</GtkLabel>
                </AdwDialog>
            </InApp>,
        );

        const dialog = requireWidget(ref, "Dialog");
        expect(dialog.getChild()).toBeInstanceOf(Gtk.Label);
        expect(within(dialog).getByText("Plain content")).toBe(dialog.getChild());
    });
});
