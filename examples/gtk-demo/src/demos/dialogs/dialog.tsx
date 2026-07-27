import * as Gtk from "@gtkx/gi/gtk";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton, GtkEntry, GtkGrid, GtkGridLayoutChild, GtkLabel, GtkSeparator } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./dialog.tsx?raw";

type DialogEntryFieldProps = {
    row: number;
    label: string;
    entryName: string;
    text: string;
    setText: (v: string) => void;
    widget: Gtk.Entry | null;
    setWidget: (w: Gtk.Entry | null) => void;
};

type DialogEntryRowProps = {
    entry1: string;
    setEntry1: (v: string) => void;
    entry2: string;
    setEntry2: (v: string) => void;
    entry1Widget: Gtk.Entry | null;
    setEntry1Widget: (w: Gtk.Entry | null) => void;
    entry2Widget: Gtk.Entry | null;
    setEntry2Widget: (w: Gtk.Entry | null) => void;
    onOpenInteractive: () => void;
};

type InteractiveDialogProps = {
    entry1Text: string;
    setEntry1Text: (v: string) => void;
    entry2Text: string;
    setEntry2Text: (v: string) => void;
    onResponse: (response: string) => void;
};

const dialogDemo: Demo = {
    id: "dialog",
    title: "Dialogs",
    description: "Dialogs are used to pop up transient windows for information and user feedback.",
    keywords: ["GtkMessageDialog"],
    component: DialogDemo,
    sourceCode,
    resizable: false,
};

const DialogEntryField = ({
    row,
    label,
    entryName,
    text,
    setText,
    widget,
    setWidget,
}: DialogEntryFieldProps) => (
    <>
        <GtkGridLayoutChild column={0} row={row}>
            <GtkLabel useUnderline mnemonicWidget={widget}>
                {label}
            </GtkLabel>
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={1} row={row}>
            <GtkEntry
                name={entryName}
                ref={(node) => {
                    setWidget(node);
                }}
                text={text}
                onChanged={(e) => {
                    setText(e.getText());
                }}
            />
        </GtkGridLayoutChild>
    </>
);

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
        <GtkGrid rowSpacing={4} columnSpacing={4}>
            <DialogEntryField
                row={0}
                label="_Entry 1"
                entryName="demo-entry-1"
                text={entry1}
                setText={setEntry1}
                widget={entry1Widget}
                setWidget={setEntry1Widget}
            />
            <DialogEntryField
                row={1}
                label="E_ntry 2"
                entryName="demo-entry-2"
                text={entry2}
                setText={setEntry2}
                widget={entry2Widget}
                setWidget={setEntry2Widget}
            />
        </GtkGrid>
    </GtkBox>
);

const MessageDialog = ({ clickCount, onClose }: { clickCount: number; onClose: () => void }) => (
    <AdwAlertDialog
        name="message-dialog"
        heading="Test message"
        body={clickCount === 1 ? "Has been shown once" : `Has been shown ${String(clickCount)} times`}
        defaultResponse="ok"
        closeResponse="cancel"
        responses={[
            { id: "cancel", label: "_Cancel" },
            { id: "ok", label: "_OK" },
        ]}
        onResponse={onClose}
    />
);

const InteractiveFields = ({
    entry1Text,
    setEntry1Text,
    entry2Text,
    setEntry2Text,
}: Omit<InteractiveDialogProps, "onResponse">) => {
    const [dialogEntry1Widget, setDialogEntry1Widget] = useState<Gtk.Entry | null>(null);
    const [dialogEntry2Widget, setDialogEntry2Widget] = useState<Gtk.Entry | null>(null);

    return (
        <GtkGrid rowSpacing={6} columnSpacing={6} hexpand vexpand halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
            <DialogEntryField
                row={0}
                label="_Entry 1"
                entryName="dialog-entry-1"
                text={entry1Text}
                setText={setEntry1Text}
                widget={dialogEntry1Widget}
                setWidget={setDialogEntry1Widget}
            />
            <DialogEntryField
                row={1}
                label="E_ntry 2"
                entryName="dialog-entry-2"
                text={entry2Text}
                setText={setEntry2Text}
                widget={dialogEntry2Widget}
                setWidget={setDialogEntry2Widget}
            />
        </GtkGrid>
    );
};

const InteractiveDialog = ({
    entry1Text,
    setEntry1Text,
    entry2Text,
    setEntry2Text,
    onResponse,
}: InteractiveDialogProps) => (
    <AdwAlertDialog
        name="interactive-dialog"
        heading="Interactive Dialog"
        defaultResponse="ok"
        closeResponse="cancel"
        responses={[
            { id: "cancel", label: "_Cancel" },
            { id: "ok", label: "_OK" },
        ]}
        onResponse={onResponse}
        extraChild={(
            <InteractiveFields
                entry1Text={entry1Text}
                setEntry1Text={setEntry1Text}
                entry2Text={entry2Text}
                setEntry2Text={setEntry2Text}
            />
        )}
    />
);

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

function DialogDemo() {
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
                <MessageDialog
                    clickCount={state.clickCount}
                    onClose={() => {
                        state.setShowMessageDialog(false);
                    }}
                />
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
}

export { dialogDemo };
