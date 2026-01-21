import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkHeaderBar, GtkPasswordEntry, x } from "@gtkx/react";
import { useCallback, useState } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./password-entry.tsx?raw";

const PasswordEntryDemo = ({ onClose }: DemoProps) => {
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");

    const passwordsMatch = password.length > 0 && password === confirm;

    const handlePasswordChanged = useCallback((entry: Gtk.PasswordEntry) => {
        setPassword(entry.getText());
    }, []);

    const handleConfirmChanged = useCallback((entry: Gtk.PasswordEntry) => {
        setConfirm(entry.getText());
    }, []);

    return (
        <>
            <x.Slot for="GtkWindow" id="titlebar">
                <GtkHeaderBar showTitleButtons={false}>
                    <x.PackEnd>
                        <GtkButton
                            label="_Done"
                            useUnderline
                            cssClasses={["suggested-action"]}
                            sensitive={passwordsMatch}
                            onClicked={onClose}
                        />
                    </x.PackEnd>
                </GtkHeaderBar>
            </x.Slot>
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={6}
                marginStart={18}
                marginEnd={18}
                marginTop={18}
                marginBottom={18}
            >
                <GtkPasswordEntry
                    showPeekIcon
                    placeholderText="Password"
                    activatesDefault
                    onChanged={handlePasswordChanged}
                />
                <GtkPasswordEntry
                    showPeekIcon
                    placeholderText="Confirm"
                    activatesDefault
                    onChanged={handleConfirmChanged}
                />
            </GtkBox>
        </>
    );
};

export const passwordEntryDemo: Demo = {
    id: "password-entry",
    title: "Entry/Password Entry",
    description:
        "GtkPasswordEntry provides common functionality of entries that are used to enter passwords and other secrets. It will display a warning if CapsLock is on, and it can optionally provide a way to see the text.",
    keywords: ["password", "entry", "secure", "GtkPasswordEntry", "peek"],
    component: PasswordEntryDemo,
    sourceCode,
};
