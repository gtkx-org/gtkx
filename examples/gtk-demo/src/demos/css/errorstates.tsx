import { css, injectGlobal } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkCheckButton, GtkEntry, GtkFrame, GtkLabel, GtkSpinButton } from "@gtkx/react";
import { useMemo, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./errorstates.tsx?raw";

const fieldErrorStyle = css`
 color: @error_color;
 font-size: 0.85em;
`;

injectGlobal`
.field-success entry,
.field-success spinbutton {
 border-color: @success_color;
}

.error-shake {
 animation: shake 0.3s ease-in-out;
}

@keyframes shake {
 0%, 100% { transform: translateX(0); }
 25% { transform: translateX(-5px); }
 75% { transform: translateX(5px); }
}
`;

interface ValidationState {
    email: { value: string; error: string | null };
    password: { value: string; error: string | null };
    age: { value: number; error: string | null };
    terms: { checked: boolean; error: string | null };
}

const validateEmail = (email: string): string | null => {
    if (!email) return "Email is required";
    if (!email.includes("@")) return "Email must contain @";
    if (!email.includes(".")) return "Email must contain a domain";
    return null;
};

const validatePassword = (password: string): string | null => {
    if (!password) return "Password is required";
    if (password.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter";
    if (!/[0-9]/.test(password)) return "Password must contain a number";
    return null;
};

const validateAge = (age: number): string | null => {
    if (age < 18) return "You must be at least 18 years old";
    if (age > 120) return "Please enter a valid age";
    return null;
};

const ErrorstatesDemo = () => {
    const [validation, setValidation] = useState<ValidationState>({
        email: { value: "", error: null },
        password: { value: "", error: null },
        age: { value: 25, error: null },
        terms: { checked: false, error: null },
    });
    const [showErrors, setShowErrors] = useState(false);

    const ageAdjustment = useMemo(() => new Gtk.Adjustment(25, 0, 150, 1, 10, 0), []);

    const handleEmailChange = (entry: Gtk.Entry) => {
        const value = entry.getText();
        const error = showErrors ? validateEmail(value) : null;
        setValidation((prev) => ({ ...prev, email: { value, error } }));
    };

    const handlePasswordChange = (entry: Gtk.Entry) => {
        const value = entry.getText();
        const error = showErrors ? validatePassword(value) : null;
        setValidation((prev) => ({ ...prev, password: { value, error } }));
    };

    const handleAgeChange = (spinButton: Gtk.SpinButton) => {
        const value = spinButton.getValue();
        const error = showErrors ? validateAge(value) : null;
        setValidation((prev) => ({ ...prev, age: { value, error } }));
    };

    const handleTermsChange = (checkButton: Gtk.CheckButton) => {
        const checked = checkButton.getActive();
        const error = showErrors && !checked ? "You must accept the terms" : null;
        setValidation((prev) => ({ ...prev, terms: { checked, error } }));
    };

    const handleValidate = () => {
        setShowErrors(true);
        setValidation((prev) => ({
            email: { ...prev.email, error: validateEmail(prev.email.value) },
            password: { ...prev.password, error: validatePassword(prev.password.value) },
            age: { ...prev.age, error: validateAge(prev.age.value) },
            terms: { ...prev.terms, error: !prev.terms.checked ? "You must accept the terms" : null },
        }));
    };

    const handleReset = () => {
        setShowErrors(false);
        setValidation({
            email: { value: "", error: null },
            password: { value: "", error: null },
            age: { value: 25, error: null },
            terms: { checked: false, error: null },
        });
    };

    const hasErrors =
        validation.email.error || validation.password.error || validation.age.error || validation.terms.error;

    const isValid =
        showErrors && !hasErrors && validation.email.value && validation.password.value && validation.terms.checked;

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Error States" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GTK provides the .error CSS class for indicating validation errors. This demo shows how to implement form validation with visual feedback using GTK's built-in styling."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Registration Form">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginStart={20}
                    marginEnd={20}
                    marginTop={20}
                    marginBottom={20}
                >
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                        <GtkLabel label="Email" halign={Gtk.Align.START} />
                        <GtkEntry
                            placeholderText="Enter your email"
                            cssClasses={
                                validation.email.error ? ["error"] : validation.email.value && showErrors ? [] : []
                            }
                            onChanged={handleEmailChange}
                        />
                        {validation.email.error && (
                            <GtkLabel
                                label={validation.email.error}
                                halign={Gtk.Align.START}
                                cssClasses={[fieldErrorStyle]}
                            />
                        )}
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                        <GtkLabel label="Password" halign={Gtk.Align.START} />
                        <GtkEntry
                            placeholderText="Enter your password"
                            visibility={false}
                            cssClasses={validation.password.error ? ["error"] : []}
                            onChanged={handlePasswordChange}
                        />
                        {validation.password.error && (
                            <GtkLabel
                                label={validation.password.error}
                                halign={Gtk.Align.START}
                                cssClasses={[fieldErrorStyle]}
                            />
                        )}
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                        <GtkLabel label="Age" halign={Gtk.Align.START} />
                        <GtkSpinButton
                            climbRate={1}
                            digits={0}
                            adjustment={ageAdjustment}
                            cssClasses={validation.age.error ? ["error"] : []}
                            onValueChanged={handleAgeChange}
                        />
                        {validation.age.error && (
                            <GtkLabel
                                label={validation.age.error}
                                halign={Gtk.Align.START}
                                cssClasses={[fieldErrorStyle]}
                            />
                        )}
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                        <GtkCheckButton
                            label="I accept the terms and conditions"
                            cssClasses={validation.terms.error ? ["error"] : []}
                            onToggled={handleTermsChange}
                        />
                        {validation.terms.error && (
                            <GtkLabel
                                label={validation.terms.error}
                                halign={Gtk.Align.START}
                                cssClasses={[fieldErrorStyle]}
                            />
                        )}
                    </GtkBox>

                    <GtkBox spacing={12} halign={Gtk.Align.END}>
                        <GtkButton label="Reset" onClicked={handleReset} cssClasses={["flat"]} />
                        <GtkButton label="Validate" onClicked={handleValidate} cssClasses={["suggested-action"]} />
                    </GtkBox>

                    {isValid && (
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} cssClasses={["card"]} halign={Gtk.Align.CENTER}>
                            <GtkLabel
                                label="All fields are valid!"
                                cssClasses={["success"]}
                                marginStart={16}
                                marginEnd={16}
                                marginTop={8}
                                marginBottom={8}
                            />
                        </GtkBox>
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Error CSS Classes">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkBox spacing={16}>
                        <GtkEntry placeholderText="Normal" />
                        <GtkEntry placeholderText="With .error class" cssClasses={["error"]} />
                        <GtkEntry placeholderText="With .warning class" cssClasses={["warning"]} />
                        <GtkEntry placeholderText="With .success class" cssClasses={["success"]} />
                    </GtkBox>
                    <GtkLabel
                        label="Apply cssClasses={['error']}, cssClasses={['warning']}, or cssClasses={['success']} to indicate field states."
                        wrap
                        cssClasses={["dim-label", "caption"]}
                        halign={Gtk.Align.START}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const errorstatesDemo: Demo = {
    id: "errorstates",
    title: "Error States",
    description: "Form validation with error styling",
    keywords: ["css", "error", "validation", "form", "warning", "success", "state"],
    component: ErrorstatesDemo,
    sourceCode,
};
