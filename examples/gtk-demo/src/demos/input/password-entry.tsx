import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkHeaderBar, GtkPasswordEntry } from "@gtkx/jsx/gtk";
import { createContext, useContext, useState } from "react";
import type { Demo, DemoProps, DemoProviderProps } from "../types.js";
import { useDemo } from "../../context/demo-context.js";
import sourceCode from "./password-entry.tsx?raw";

type TextNotifyHandler = (pspec: GObject.ParamSpec, self: Gtk.PasswordEntry) => void;

type PasswordEntryContextValue = {
    arePasswordsMatching: boolean;
    handlePasswordNotify: TextNotifyHandler;
    handleConfirmNotify: TextNotifyHandler;
};

const PasswordEntryContext = createContext<PasswordEntryContextValue | null>(null);

const passwordEntryDemo: Demo = {
    id: "password-entry",
    title: "Entry/Password Entry",
    description:
        "GtkPasswordEntry provides common functionality of entries that are used to enter passwords " +
        "and other secrets.\n\nIt will display a warning if CapsLock is on, and it can optionally " +
        "provide a way to see the text.",
    keywords: [],
    component: PasswordEntryDemo,
    titlebar: PasswordEntryTitlebar,
    provider: PasswordEntryProvider,
    sourceCode,
    windowTitle: "Choose a Password",
    isResizable: false,
    isDeletable: false,
};

function usePasswordEntryContext(): PasswordEntryContextValue {
    const ctx = useContext(PasswordEntryContext);

    if (!ctx) {
        throw new Error("PasswordEntryContext is missing");
    }

    return ctx;
}

const createTextNotifyHandler = (setText: (text: string) => void): TextNotifyHandler => (pspec, self) => {
    if (pspec.getName() === "text") {
        setText(self.getText());
    }
};

function PasswordEntryProvider({ children }: DemoProviderProps) {
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const arePasswordsMatching = password.length > 0 && password === confirm;
    const handlePasswordNotify = createTextNotifyHandler(setPassword);
    const handleConfirmNotify = createTextNotifyHandler(setConfirm);

    const value = {
        arePasswordsMatching,
        handlePasswordNotify,
        handleConfirmNotify,
    };

    return <PasswordEntryContext.Provider value={value}>{children}</PasswordEntryContext.Provider>;
}

function PasswordEntryTitlebar({ onClose }: DemoProps) {
    const { arePasswordsMatching } = usePasswordEntryContext();
    const { setDefaultWidget } = useDemo();

    return (
        <GtkHeaderBar
            name="password-entry-header"
            showTitleButtons={false}
            end={(
                <GtkButton
                    ref={setDefaultWidget}
                    label="_Done"
                    useUnderline
                    cssClasses={["suggested-action"]}
                    sensitive={arePasswordsMatching}
                    onClicked={onClose}
                />
            )}
        />
    );
}

function PasswordEntryDemo() {
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
}

export { passwordEntryDemo };
