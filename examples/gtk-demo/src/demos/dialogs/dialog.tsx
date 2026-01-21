import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    AdwAlertDialog,
    createPortal,
    GtkBox,
    GtkButton,
    GtkEntry,
    GtkGrid,
    GtkLabel,
    GtkSeparator,
    useApplication,
    x,
} from "@gtkx/react";
import { useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./dialog.tsx?raw";

const DialogDemo = () => {
    const app = useApplication();
    const activeWindow = app.getActiveWindow();

    const [clickCount, setClickCount] = useState(0);
    const [entry1, setEntry1] = useState("");
    const [entry2, setEntry2] = useState("");

    const [showMessageDialog, setShowMessageDialog] = useState(false);
    const [showInteractiveDialog, setShowInteractiveDialog] = useState(false);

    const dialogEntry1Ref = useRef<Gtk.Entry>(null);
    const dialogEntry2Ref = useRef<Gtk.Entry>(null);

    const handleMessageDialogOpen = () => {
        setClickCount((c) => c + 1);
        setShowMessageDialog(true);
    };

    const handleInteractiveDialogResponse = (_dialog: Adw.AlertDialog, response: string) => {
        if (response === "ok") {
            setEntry1(dialogEntry1Ref.current?.getText() ?? "");
            setEntry2(dialogEntry2Ref.current?.getText() ?? "");
        }
        setShowInteractiveDialog(false);
    };

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={8}
            marginTop={8}
            marginBottom={8}
            marginStart={8}
            marginEnd={8}
        >
            <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
                <GtkButton label="_Message Dialog" useUnderline onClicked={handleMessageDialogOpen} />
            </GtkBox>

            <GtkSeparator orientation={Gtk.Orientation.HORIZONTAL} />

            <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
                <GtkButton label="_Interactive Dialog" useUnderline onClicked={() => setShowInteractiveDialog(true)} />
                <GtkGrid rowSpacing={4} columnSpacing={4}>
                    <x.GridChild column={0} row={0}>
                        <GtkLabel label="_Entry 1" useUnderline />
                    </x.GridChild>
                    <x.GridChild column={1} row={0}>
                        <GtkEntry text={entry1} onChanged={(e) => setEntry1(e.getText())} />
                    </x.GridChild>
                    <x.GridChild column={0} row={1}>
                        <GtkLabel label="E_ntry 2" useUnderline />
                    </x.GridChild>
                    <x.GridChild column={1} row={1}>
                        <GtkEntry text={entry2} onChanged={(e) => setEntry2(e.getText())} />
                    </x.GridChild>
                </GtkGrid>
            </GtkBox>

            {showMessageDialog &&
                activeWindow &&
                createPortal(
                    <AdwAlertDialog
                        heading="Information"
                        body={`This message box has been popped up ${clickCount} time${clickCount === 1 ? "" : "s"}.`}
                        defaultResponse="ok"
                        closeResponse="ok"
                        onResponse={() => setShowMessageDialog(false)}
                    >
                        <x.AlertDialogResponse id="ok" label="_OK" />
                    </AdwAlertDialog>,
                    activeWindow,
                )}

            {showInteractiveDialog &&
                activeWindow &&
                createPortal(
                    <AdwAlertDialog
                        heading="Interactive Dialog"
                        defaultResponse="ok"
                        closeResponse="cancel"
                        onResponse={handleInteractiveDialogResponse}
                    >
                        <x.Slot for="AdwAlertDialog" id="extraChild">
                            <GtkGrid
                                rowSpacing={6}
                                columnSpacing={6}
                                hexpand
                                vexpand
                                halign={Gtk.Align.CENTER}
                                valign={Gtk.Align.CENTER}
                            >
                                <x.GridChild column={0} row={0}>
                                    <GtkLabel label="_Entry 1" useUnderline />
                                </x.GridChild>
                                <x.GridChild column={1} row={0}>
                                    <GtkEntry ref={dialogEntry1Ref} text={entry1} />
                                </x.GridChild>
                                <x.GridChild column={0} row={1}>
                                    <GtkLabel label="E_ntry 2" useUnderline />
                                </x.GridChild>
                                <x.GridChild column={1} row={1}>
                                    <GtkEntry ref={dialogEntry2Ref} text={entry2} />
                                </x.GridChild>
                            </GtkGrid>
                        </x.Slot>
                        <x.AlertDialogResponse id="cancel" label="_Cancel" />
                        <x.AlertDialogResponse id="ok" label="_OK" appearance={Adw.ResponseAppearance.SUGGESTED} />
                    </AdwAlertDialog>,
                    activeWindow,
                )}
        </GtkBox>
    );
};

export const dialogDemo: Demo = {
    id: "dialog",
    title: "Dialogs",
    description:
        "A dialog is a transient window that appears in response to some user action. The Message Dialog shows a simple message box, while the Interactive Dialog demonstrates bidirectional data transfer with form fields.",
    keywords: ["dialog", "modal", "alert", "message", "interactive", "AdwAlertDialog", "entry", "form"],
    component: DialogDemo,
    sourceCode,
};
