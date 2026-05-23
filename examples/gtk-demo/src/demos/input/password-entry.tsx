import type * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkHeaderBar, GtkPasswordEntry } from "@gtkx/react";
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Demo, DemoProps, DemoProviderProps } from "../types.js";
import sourceCode from "./password-entry.tsx?raw";

interface PasswordEntryContextValue {
    buttonRef: React.RefObject<Gtk.Button | null>;
    passwordRef: React.RefObject<Gtk.PasswordEntry | null>;
    confirmRef: React.RefObject<Gtk.PasswordEntry | null>;
    passwordsMatch: boolean;
    handlePasswordNotify: (pspec: GObject.ParamSpec) => void;
    handleConfirmNotify: (pspec: GObject.ParamSpec) => void;
}

const PasswordEntryContext = createContext<PasswordEntryContextValue | null>(null);

const usePasswordEntryContext = (): PasswordEntryContextValue => {
    const ctx = useContext(PasswordEntryContext);
    if (!ctx) throw new Error("PasswordEntryContext is missing");
    return ctx;
};

const PasswordEntryProvider = ({ children }: DemoProviderProps) => {
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");

    const buttonRef = useRef<Gtk.Button | null>(null);
    const passwordRef = useRef<Gtk.PasswordEntry | null>(null);
    const confirmRef = useRef<Gtk.PasswordEntry | null>(null);

    const passwordsMatch = password.length > 0 && password === confirm;

    const handlePasswordNotify = useCallback((pspec: GObject.ParamSpec) => {
        if (pspec.getName() === "text") setPassword(passwordRef.current?.getText() ?? "");
    }, []);

    const handleConfirmNotify = useCallback((pspec: GObject.ParamSpec) => {
        if (pspec.getName() === "text") setConfirm(confirmRef.current?.getText() ?? "");
    }, []);

    const value = useMemo<PasswordEntryContextValue>(
        () => ({
            buttonRef,
            passwordRef,
            confirmRef,
            passwordsMatch,
            handlePasswordNotify,
            handleConfirmNotify,
        }),
        [passwordsMatch, handlePasswordNotify, handleConfirmNotify],
    );

    return <PasswordEntryContext.Provider value={value}>{children}</PasswordEntryContext.Provider>;
};

const PasswordEntryTitlebar = ({ onClose }: DemoProps) => {
    const { buttonRef, passwordsMatch } = usePasswordEntryContext();
    return (
        <GtkHeaderBar showTitleButtons={false}>
            <GtkHeaderBar.PackEnd>
                <GtkButton
                    ref={buttonRef}
                    label="_Done"
                    useUnderline
                    cssClasses={["suggested-action"]}
                    sensitive={passwordsMatch}
                    onClicked={onClose}
                />
            </GtkHeaderBar.PackEnd>
        </GtkHeaderBar>
    );
};

const PasswordEntryDemo = ({ window }: DemoProps) => {
    const { buttonRef, passwordRef, confirmRef, handlePasswordNotify, handleConfirmNotify } = usePasswordEntryContext();

    useLayoutEffect(() => {
        const btn = buttonRef.current;
        const win = window.current;
        if (btn && win) {
            win.setDefaultWidget(btn);
            win.setDeletable(false);
        }
    }, [window, buttonRef]);

    return (
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
    );
};

export const passwordEntryDemo: Demo = {
    id: "password-entry",
    title: "Entry/Password Entry",
    description:
        "GtkPasswordEntry provides common functionality of entries that are used to enter passwords and other secrets.\n\nIt will display a warning if CapsLock is on, and it can optionally provide a way to see the text.",
    keywords: [],
    component: PasswordEntryDemo,
    titlebar: PasswordEntryTitlebar,
    provider: PasswordEntryProvider,
    sourceCode,
};
