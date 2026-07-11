import { Grid } from "@gtkx/components";
import { AlertDialog, Dialog } from "@gtkx/components/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkEntry, GtkLabel, GtkSeparator } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./dialog.tsx?raw";

interface DialogEntryRowProps {
    entry1: string;
    setEntry1: (v: string) => void;
    entry2: string;
    setEntry2: (v: string) => void;
    entry1Widget: Gtk.Entry | null;
    setEntry1Widget: (w: Gtk.Entry | null) => void;
    entry2Widget: Gtk.Entry | null;
    setEntry2Widget: (w: Gtk.Entry | null) => void;
    onOpenInteractive: () => void;
}

const DialogEntryRow = ({
    entry1,
    setEntry1,
    entry2,
    setEntry2,
    entry1Widget,
    setEntry1Widget,
    entry2Widget,
    setEntry2Widget,
    onOpenInteractive,
}: DialogEntryRowProps) => (
    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
        <GtkButton label="_Interactive Dialog" useUnderline valign={Gtk.Align.START} onClicked={onOpenInteractive} />
        <Grid rowSpacing={4} columnSpacing={4}>
            <Grid.Child column={0} row={0}>
                {(ref) => <GtkLabel ref={ref} label="_Entry 1" useUnderline mnemonicWidget={entry1Widget} />}
            </Grid.Child>
            <Grid.Child column={1} row={0}>
                {(ref) => (
                    <GtkEntry
                        name="demo-entry-1"
                        ref={(node) => {
                            ref(node);
                            setEntry1Widget(node);
                        }}
                        text={entry1}
                        onChanged={(e) => setEntry1(e.getText())}
                    />
                )}
            </Grid.Child>
            <Grid.Child column={0} row={1}>
                {(ref) => <GtkLabel ref={ref} label="E_ntry 2" useUnderline mnemonicWidget={entry2Widget} />}
            </Grid.Child>
            <Grid.Child column={1} row={1}>
                {(ref) => (
                    <GtkEntry
                        name="demo-entry-2"
                        ref={(node) => {
                            ref(node);
                            setEntry2Widget(node);
                        }}
                        text={entry2}
                        onChanged={(e) => setEntry2(e.getText())}
                    />
                )}
            </Grid.Child>
        </Grid>
    </GtkBox>
);

const MessageDialog = ({ clickCount, onClose }: { clickCount: number; onClose: () => void }) => (
    <Dialog>
        <AlertDialog
            name="message-dialog"
            heading="Test message"
            body={clickCount === 1 ? "Has been shown once" : `Has been shown ${clickCount} times`}
            defaultResponse="ok"
            closeResponse="cancel"
            onResponse={onClose}
        >
            <AlertDialog.Response id="cancel" label="_Cancel" />
            <AlertDialog.Response id="ok" label="_OK" />
        </AlertDialog>
    </Dialog>
);

interface InteractiveDialogProps {
    entry1Text: string;
    setEntry1Text: (v: string) => void;
    entry2Text: string;
    setEntry2Text: (v: string) => void;
    onResponse: (response: string) => void;
}

const InteractiveDialog = ({
    entry1Text,
    setEntry1Text,
    entry2Text,
    setEntry2Text,
    onResponse,
}: InteractiveDialogProps) => {
    const [dialogEntry1Widget, setDialogEntry1Widget] = useState<Gtk.Entry | null>(null);
    const [dialogEntry2Widget, setDialogEntry2Widget] = useState<Gtk.Entry | null>(null);
    return (
        <Dialog>
            <AlertDialog
                name="interactive-dialog"
                heading="Interactive Dialog"
                defaultResponse="ok"
                closeResponse="cancel"
                onResponse={onResponse}
                extraChild={
                    <Grid
                        rowSpacing={6}
                        columnSpacing={6}
                        hexpand
                        vexpand
                        halign={Gtk.Align.CENTER}
                        valign={Gtk.Align.CENTER}
                    >
                        <Grid.Child column={0} row={0}>
                            {(ref) => (
                                <GtkLabel ref={ref} label="_Entry 1" useUnderline mnemonicWidget={dialogEntry1Widget} />
                            )}
                        </Grid.Child>
                        <Grid.Child column={1} row={0}>
                            {(ref) => (
                                <GtkEntry
                                    name="dialog-entry-1"
                                    ref={(node) => {
                                        ref(node);
                                        setDialogEntry1Widget(node);
                                    }}
                                    text={entry1Text}
                                    onChanged={(e) => setEntry1Text(e.getText())}
                                />
                            )}
                        </Grid.Child>
                        <Grid.Child column={0} row={1}>
                            {(ref) => (
                                <GtkLabel ref={ref} label="E_ntry 2" useUnderline mnemonicWidget={dialogEntry2Widget} />
                            )}
                        </Grid.Child>
                        <Grid.Child column={1} row={1}>
                            {(ref) => (
                                <GtkEntry
                                    name="dialog-entry-2"
                                    ref={(node) => {
                                        ref(node);
                                        setDialogEntry2Widget(node);
                                    }}
                                    text={entry2Text}
                                    onChanged={(e) => setEntry2Text(e.getText())}
                                />
                            )}
                        </Grid.Child>
                    </Grid>
                }
            >
                <AlertDialog.Response id="cancel" label="_Cancel" />
                <AlertDialog.Response id="ok" label="_OK" />
            </AlertDialog>
        </Dialog>
    );
};

function useDialogDemoState() {
    const [clickCount, setClickCount] = useState(0);
    const [entry1, setEntry1] = useState("");
    const [entry2, setEntry2] = useState("");
    const [showMessageDialog, setShowMessageDialog] = useState(false);
    const [showInteractiveDialog, setShowInteractiveDialog] = useState(false);
    const [entry1Widget, setEntry1Widget] = useState<Gtk.Entry | null>(null);
    const [entry2Widget, setEntry2Widget] = useState<Gtk.Entry | null>(null);
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

    return {
        clickCount,
        entry1,
        setEntry1,
        entry2,
        setEntry2,
        showMessageDialog,
        setShowMessageDialog,
        showInteractiveDialog,
        entry1Widget,
        setEntry1Widget,
        entry2Widget,
        setEntry2Widget,
        dialogEntry1Text,
        setDialogEntry1Text,
        dialogEntry2Text,
        setDialogEntry2Text,
        handleMessageDialogOpen,
        handleOpenInteractiveDialog,
        handleInteractiveDialogResponse,
    };
}

const DialogDemo = () => {
    const state = useDialogDemoState();
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
                <GtkButton label="_Message Dialog" useUnderline onClicked={state.handleMessageDialogOpen} />
            </GtkBox>
            <GtkSeparator orientation={Gtk.Orientation.HORIZONTAL} />
            <DialogEntryRow
                entry1={state.entry1}
                setEntry1={state.setEntry1}
                entry2={state.entry2}
                setEntry2={state.setEntry2}
                entry1Widget={state.entry1Widget}
                setEntry1Widget={state.setEntry1Widget}
                entry2Widget={state.entry2Widget}
                setEntry2Widget={state.setEntry2Widget}
                onOpenInteractive={state.handleOpenInteractiveDialog}
            />
            {state.showMessageDialog && (
                <MessageDialog clickCount={state.clickCount} onClose={() => state.setShowMessageDialog(false)} />
            )}
            {state.showInteractiveDialog && (
                <InteractiveDialog
                    entry1Text={state.dialogEntry1Text}
                    setEntry1Text={state.setDialogEntry1Text}
                    entry2Text={state.dialogEntry2Text}
                    setEntry2Text={state.setDialogEntry2Text}
                    onResponse={state.handleInteractiveDialogResponse}
                />
            )}
        </GtkBox>
    );
};

export const dialogDemo: Demo = {
    id: "dialog",
    title: "Dialogs",
    description: "Dialogs are used to pop up transient windows for information and user feedback.",
    keywords: ["GtkMessageDialog"],
    component: DialogDemo,
    sourceCode,
    resizable: false,
};
