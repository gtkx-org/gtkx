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
    x,
} from "@gtkx/react";
import { useState } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./dialog.tsx?raw";

const DialogDemo = ({ window }: DemoProps) => {
    const [clickCount, setClickCount] = useState(0);
    const [entry1, setEntry1] = useState("");
    const [entry2, setEntry2] = useState("");

    const [showMessageDialog, setShowMessageDialog] = useState(false);
    const [showInteractiveDialog, setShowInteractiveDialog] = useState(false);

    const [entry1Widget, setEntry1Widget] = useState<Gtk.Entry | null>(null);
    const [entry2Widget, setEntry2Widget] = useState<Gtk.Entry | null>(null);
    const [dialogEntry1Widget, setDialogEntry1Widget] = useState<Gtk.Entry | null>(null);
    const [dialogEntry2Widget, setDialogEntry2Widget] = useState<Gtk.Entry | null>(null);

    const [dialogEntry1Text, setDialogEntry1Text] = useState("");
    const [dialogEntry2Text, setDialogEntry2Text] = useState("");

    const handleMessageDialogOpen = () => {
        setClickCount((c) => c + 1);
        setShowMessageDialog(true);
    };

    const handleOpenInteractiveDialog = () => {
        setDialogEntry1Text(entry1);
        setDialogEntry2Text(entry2);
        setShowInteractiveDialog(true);
    };

    const handleInteractiveDialogResponse = (response: string) => {
        if (response === "ok") {
            setEntry1(dialogEntry1Text);
            setEntry2(dialogEntry2Text);
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
                <GtkButton label="_Interactive Dialog" useUnderline onClicked={handleOpenInteractiveDialog} />
                <GtkGrid rowSpacing={4} columnSpacing={4}>
                    <x.GridChild column={0} row={0}>
                        <GtkLabel label="_Entry 1" useUnderline mnemonicWidget={entry1Widget} />
                    </x.GridChild>
                    <x.GridChild column={1} row={0}>
                        <GtkEntry ref={setEntry1Widget} text={entry1} onChanged={(e) => setEntry1(e.getText())} />
                    </x.GridChild>
                    <x.GridChild column={0} row={1}>
                        <GtkLabel label="E_ntry 2" useUnderline mnemonicWidget={entry2Widget} />
                    </x.GridChild>
                    <x.GridChild column={1} row={1}>
                        <GtkEntry ref={setEntry2Widget} text={entry2} onChanged={(e) => setEntry2(e.getText())} />
                    </x.GridChild>
                </GtkGrid>
            </GtkBox>

            {showMessageDialog &&
                window.current &&
                createPortal(
                    <AdwAlertDialog
                        heading="Test message"
                        body={
                            clickCount === 1
                                ? "This message box has been popped up 1 time."
                                : `This message box has been popped up ${clickCount} times.`
                        }
                        defaultResponse="ok"
                        closeResponse="cancel"
                        onResponse={() => setShowMessageDialog(false)}
                    >
                        <x.AlertDialogResponse id="cancel" label="_Cancel" />
                        <x.AlertDialogResponse id="ok" label="_OK" />
                    </AdwAlertDialog>,
                    window.current,
                )}

            {showInteractiveDialog &&
                window.current &&
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
                                    <GtkLabel label="_Entry 1" useUnderline mnemonicWidget={dialogEntry1Widget} />
                                </x.GridChild>
                                <x.GridChild column={1} row={0}>
                                    <GtkEntry
                                        ref={setDialogEntry1Widget}
                                        text={dialogEntry1Text}
                                        onChanged={(e) => setDialogEntry1Text(e.getText())}
                                    />
                                </x.GridChild>
                                <x.GridChild column={0} row={1}>
                                    <GtkLabel label="E_ntry 2" useUnderline mnemonicWidget={dialogEntry2Widget} />
                                </x.GridChild>
                                <x.GridChild column={1} row={1}>
                                    <GtkEntry
                                        ref={setDialogEntry2Widget}
                                        text={dialogEntry2Text}
                                        onChanged={(e) => setDialogEntry2Text(e.getText())}
                                    />
                                </x.GridChild>
                            </GtkGrid>
                        </x.Slot>
                        <x.AlertDialogResponse id="cancel" label="_Cancel" />
                        <x.AlertDialogResponse id="ok" label="_OK" />
                    </AdwAlertDialog>,
                    window.current,
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
