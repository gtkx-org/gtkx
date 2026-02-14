import type * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkHeaderBar, GtkPasswordEntry, x } from "@gtkx/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./password-entry.tsx?raw";

const PasswordEntryDemo = ({ onClose, window }: DemoProps) => {
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");

    const buttonRef = useRef<Gtk.Button | null>(null);
    const passwordRef = useRef<Gtk.PasswordEntry | null>(null);
    const confirmRef = useRef<Gtk.PasswordEntry | null>(null);

    const passwordsMatch = password.length > 0 && password === confirm;

    const handlePasswordNotify = useCallback((pspec: GObject.ParamSpec) => {
        if (pspec.getName() === "text") {
            setPassword(passwordRef.current?.getText() ?? "");
        }
    }, []);

    const handleConfirmNotify = useCallback((pspec: GObject.ParamSpec) => {
        if (pspec.getName() === "text") {
            setConfirm(confirmRef.current?.getText() ?? "");
        }
    }, []);

    useLayoutEffect(() => {
        const btn = buttonRef.current;
        const win = window.current;
        if (btn && win) {
            win.setDefaultWidget(btn);
            win.setDeletable(false);
        }
    }, [window]);

    return (
        <>
            <x.Slot for="GtkWindow" id="titlebar">
                <GtkHeaderBar showTitleButtons={false}>
                    <x.ContainerSlot for={GtkHeaderBar} id="packEnd">
                        <GtkButton
                            ref={buttonRef}
                            label="_Done"
                            useUnderline
                            cssClasses={["suggested-action"]}
                            sensitive={passwordsMatch}
                            onClicked={onClose}
                        />
                    </x.ContainerSlot>
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
                    ref={passwordRef}
                    showPeekIcon
                    placeholderText="Password"
                    accessibleLabel="Password"
                    activatesDefault
                    onNotify={handlePasswordNotify}
                />
                <GtkPasswordEntry
                    ref={confirmRef}
                    showPeekIcon
                    placeholderText="Confirm"
                    accessibleLabel="Confirm"
                    activatesDefault
                    onNotify={handleConfirmNotify}
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
