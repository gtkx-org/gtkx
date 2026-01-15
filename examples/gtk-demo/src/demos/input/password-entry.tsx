import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkPasswordEntry } from "@gtkx/react";
import { useCallback, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./password-entry.tsx?raw";

const PasswordEntryDemo = () => {
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");

    const passwordsMatch = password.length > 0 && password === confirm;
    const showMismatch = confirm.length > 0 && password !== confirm;

    const handlePasswordChanged = useCallback((entry: Gtk.PasswordEntry) => {
        setPassword(entry.getText());
    }, []);

    const handleConfirmChanged = useCallback((entry: Gtk.PasswordEntry) => {
        setConfirm(entry.getText());
    }, []);

    const handleDone = useCallback(() => {
        console.log("Password accepted!");
    }, []);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={6}
            marginStart={18}
            marginEnd={18}
            marginTop={18}
            marginBottom={18}
        >
            <GtkLabel label="Enter a new password:" halign={Gtk.Align.START} />
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
                cssClasses={showMismatch ? ["error"] : []}
                onChanged={handleConfirmChanged}
            />
            {showMismatch && (
                <GtkLabel label="Passwords do not match" cssClasses={["error"]} halign={Gtk.Align.START} />
            )}
            <GtkButton
                label="Done"
                cssClasses={["suggested-action"]}
                sensitive={passwordsMatch}
                halign={Gtk.Align.END}
                marginTop={12}
                onClicked={handleDone}
            />
        </GtkBox>
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
