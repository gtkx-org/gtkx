import type * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkHeaderBar, GtkPasswordEntry } from "@gtkx/react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useDemo } from "../../context/demo-context.js";
import type { Demo, DemoProps, DemoProviderProps } from "../types.js";
import sourceCode from "./password-entry.tsx?raw";

interface PasswordEntryContextValue {
    passwordsMatch: boolean;
    handlePasswordNotify: (pspec: GObject.ParamSpec, self: Gtk.Widget) => void;
    handleConfirmNotify: (pspec: GObject.ParamSpec, self: Gtk.Widget) => void;
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

    const passwordsMatch = password.length > 0 && password === confirm;

    const handlePasswordNotify = useCallback((pspec: GObject.ParamSpec, self: Gtk.Widget) => {
        if (pspec.getName() === "text") setPassword((self as Gtk.PasswordEntry).getText() ?? "");
    }, []);

    const handleConfirmNotify = useCallback((pspec: GObject.ParamSpec, self: Gtk.Widget) => {
        if (pspec.getName() === "text") setConfirm((self as Gtk.PasswordEntry).getText() ?? "");
    }, []);

    const value = useMemo<PasswordEntryContextValue>(
        () => ({ passwordsMatch, handlePasswordNotify, handleConfirmNotify }),
        [passwordsMatch, handlePasswordNotify, handleConfirmNotify],
    );

    return <PasswordEntryContext.Provider value={value}>{children}</PasswordEntryContext.Provider>;
};

const PasswordEntryTitlebar = ({ onClose }: DemoProps) => {
    const { passwordsMatch } = usePasswordEntryContext();
    const { setDefaultWidget } = useDemo();
    return (
        <GtkHeaderBar name="password-entry-header" showTitleButtons={false}>
            <GtkHeaderBar.PackEnd>
                <GtkButton
                    ref={setDefaultWidget}
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

const PasswordEntryDemo = () => {
    const { handlePasswordNotify, handleConfirmNotify } = usePasswordEntryContext();

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
                name="password-entry"
                showPeekIcon
                placeholderText="Password"
                accessibleLabel="Password"
                activatesDefault
                onNotify={handlePasswordNotify}
            />
            <GtkPasswordEntry
                name="confirm-entry"
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
    windowTitle: "Choose a Password",
    resizable: false,
    deletable: false,
};
