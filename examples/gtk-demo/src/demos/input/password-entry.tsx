import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkPasswordEntry } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./password-entry.tsx?raw";

const PasswordEntryDemo = () => {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const passwordsMatch = password === confirmPassword && password.length > 0;
    const passwordStrength = getPasswordStrength(password);

    function getPasswordStrength(pwd: string): { label: string; level: number } {
        if (pwd.length === 0) return { label: "Empty", level: 0 };
        if (pwd.length < 6) return { label: "Too short", level: 1 };
        if (pwd.length < 8) return { label: "Weak", level: 2 };

        let score = 0;
        if (/[a-z]/.test(pwd)) score++;
        if (/[A-Z]/.test(pwd)) score++;
        if (/[0-9]/.test(pwd)) score++;
        if (/[^a-zA-Z0-9]/.test(pwd)) score++;

        if (score <= 1) return { label: "Weak", level: 2 };
        if (score === 2) return { label: "Fair", level: 3 };
        if (score === 3) return { label: "Good", level: 4 };
        return { label: "Strong", level: 5 };
    }

    const handleSubmit = () => {
        if (passwordsMatch) {
            setSubmitted(true);
        }
    };

    const handleReset = () => {
        setPassword("");
        setConfirmPassword("");
        setSubmitted(false);
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Password Entry" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Secure Password Input" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkPasswordEntry is designed for entering passwords securely. It hides the input by default and provides a peek icon to temporarily reveal the password."
                    wrap
                    cssClasses={["dim-label"]}
                />

                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkLabel label="Password:" halign={Gtk.Align.START} />
                    <GtkPasswordEntry
                        text={password}
                        showPeekIcon
                        onChanged={(entry) => setPassword(entry.getText())}
                    />
                    <GtkLabel
                        label={`Strength: ${passwordStrength.label}`}
                        cssClasses={["dim-label"]}
                        halign={Gtk.Align.START}
                    />
                </GtkBox>

                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                    <GtkLabel label="Confirm Password:" halign={Gtk.Align.START} />
                    <GtkPasswordEntry
                        text={confirmPassword}
                        showPeekIcon
                        onChanged={(entry) => setConfirmPassword(entry.getText())}
                    />
                    {confirmPassword.length > 0 && (
                        <GtkLabel
                            label={passwordsMatch ? "Passwords match" : "Passwords do not match"}
                            cssClasses={passwordsMatch ? ["success"] : ["error"]}
                            halign={Gtk.Align.START}
                        />
                    )}
                </GtkBox>

                <GtkBox spacing={8} marginTop={8}>
                    <GtkButton
                        label="Submit"
                        cssClasses={["suggested-action"]}
                        onClicked={handleSubmit}
                        sensitive={passwordsMatch}
                    />
                    <GtkButton label="Reset" onClicked={handleReset} />
                </GtkBox>

                {submitted && (
                    <GtkLabel
                        label="Password submitted successfully!"
                        cssClasses={["success"]}
                        halign={Gtk.Align.START}
                    />
                )}
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Password Entry without Peek Icon" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="For maximum security, you can hide the peek icon so users cannot reveal the password."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkPasswordEntry showPeekIcon={false} />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Security Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={`GtkPasswordEntry provides several security features:
- Text is hidden by default
- Clipboard copy is disabled
- Caps Lock warning is shown
- Memory is stored in non-pageable area when possible`}
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const passwordEntryDemo: Demo = {
    id: "password-entry",
    title: "Entry/Password Entry",
    description: "Secure password input with peek icon and strength indicator.",
    keywords: ["password", "entry", "secure", "input", "GtkPasswordEntry", "peek"],
    component: PasswordEntryDemo,
    sourceCode,
};
