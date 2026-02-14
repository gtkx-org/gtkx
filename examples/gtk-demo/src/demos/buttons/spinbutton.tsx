import * as Gtk from "@gtkx/ffi/gtk";
import { GtkGrid, GtkLabel, GtkSpinButton, x } from "@gtkx/react";
import { type Ref, useCallback, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./spinbutton.tsx?raw";

const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

const GTK_INPUT_ERROR = -1;

const SpinButtonDemo = () => {
    const [numericValue, setNumericValue] = useState(0);
    const [hexValue, setHexValue] = useState(0);
    const [timeValue, setTimeValue] = useState(0);
    const [monthValue, setMonthValue] = useState(1);

    const numericSpinRef = useRef<Gtk.SpinButton | null>(null);
    const hexSpinRef = useRef<Gtk.SpinButton | null>(null);
    const timeSpinRef = useRef<Gtk.SpinButton | null>(null);
    const monthSpinRef = useRef<Gtk.SpinButton | null>(null);

    const handleHexInput = useCallback((newValue: Ref<number>, spin: Gtk.SpinButton) => {
        const text = spin.getText();
        if (!newValue || typeof newValue !== "object" || !("value" in newValue)) return GTK_INPUT_ERROR;
        newValue.value = 0;
        const parsed = Number.parseInt(text, 16);
        if (Number.isNaN(parsed)) return GTK_INPUT_ERROR;
        newValue.value = parsed;
        return 1;
    }, []);

    const handleHexOutput = useCallback((spin: Gtk.SpinButton) => {
        const value = spin.getValue();
        const text =
            Math.abs(value) < 1e-5 ? "0x00" : `0x${Math.round(value).toString(16).toUpperCase().padStart(2, "0")}`;
        spin.setText(text);
        return true;
    }, []);

    const handleTimeInput = useCallback((newValue: Ref<number>, spin: Gtk.SpinButton) => {
        const text = spin.getText();
        if (!newValue || typeof newValue !== "object" || !("value" in newValue)) return GTK_INPUT_ERROR;
        newValue.value = 0;
        const parts = text.split(":");
        if (parts.length !== 2) return GTK_INPUT_ERROR;
        const hours = Number.parseInt(parts[0] ?? "", 10);
        const minutes = Number.parseInt(parts[1] ?? "", 10);
        if (Number.isNaN(hours) || Number.isNaN(minutes)) return GTK_INPUT_ERROR;
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return GTK_INPUT_ERROR;
        newValue.value = hours * 60 + minutes;
        return 1;
    }, []);

    const handleTimeOutput = useCallback((spin: Gtk.SpinButton) => {
        const value = spin.getValue();
        const hours = Math.floor(value / 60);
        const minutes = Math.round((value / 60 - hours) * 60);
        spin.setText(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
        return true;
    }, []);

    const handleMonthInput = useCallback((newValue: Ref<number>) => {
        const spin = monthSpinRef.current;
        if (!spin || !newValue || typeof newValue !== "object" || !("value" in newValue)) return GTK_INPUT_ERROR;
        newValue.value = 0;
        const text = spin.getText().toLowerCase();
        for (let i = 0; i < MONTHS.length; i++) {
            if (MONTHS[i]?.toLowerCase().startsWith(text)) {
                newValue.value = i + 1;
                return 1;
            }
        }
        return GTK_INPUT_ERROR;
    }, []);

    const handleMonthOutput = useCallback((spin: Gtk.SpinButton) => {
        const value = spin.getValue();
        const index = Math.round(value) - 1;
        spin.setText(MONTHS[index] ?? "January");
        return true;
    }, []);

    return (
        <GtkGrid rowSpacing={10} columnSpacing={10} marginStart={20} marginEnd={20} marginTop={20} marginBottom={20}>
            <x.GridChild column={0} row={0}>
                <GtkLabel label="_Numeric" useUnderline xalign={1} mnemonicWidget={numericSpinRef.current} />
            </x.GridChild>
            <x.GridChild column={1} row={0}>
                <GtkSpinButton
                    ref={numericSpinRef}
                    halign={Gtk.Align.START}
                    widthChars={5}
                    digits={2}
                    climbRate={1}
                    numeric
                    value={numericValue}
                    lower={-10000}
                    upper={10000}
                    stepIncrement={0.5}
                    pageIncrement={100}
                    onValueChanged={setNumericValue}
                />
            </x.GridChild>
            <x.GridChild column={2} row={0}>
                <GtkLabel label={String(numericValue)} widthChars={10} xalign={1} />
            </x.GridChild>

            <x.GridChild column={0} row={1}>
                <GtkLabel label="_Hexadecimal" useUnderline xalign={1} mnemonicWidget={hexSpinRef.current} />
            </x.GridChild>
            <x.GridChild column={1} row={1}>
                <GtkSpinButton
                    ref={hexSpinRef}
                    halign={Gtk.Align.START}
                    widthChars={4}
                    wrap
                    value={hexValue}
                    lower={0}
                    upper={255}
                    stepIncrement={1}
                    pageIncrement={16}
                    onValueChanged={setHexValue}
                    onInput={handleHexInput}
                    onOutput={handleHexOutput}
                />
            </x.GridChild>
            <x.GridChild column={2} row={1}>
                <GtkLabel label={String(hexValue)} widthChars={10} xalign={1} />
            </x.GridChild>

            <x.GridChild column={0} row={2}>
                <GtkLabel label="_Time" useUnderline xalign={1} mnemonicWidget={timeSpinRef.current} />
            </x.GridChild>
            <x.GridChild column={1} row={2}>
                <GtkSpinButton
                    ref={timeSpinRef}
                    halign={Gtk.Align.START}
                    widthChars={5}
                    wrap
                    value={timeValue}
                    lower={0}
                    upper={1410}
                    stepIncrement={30}
                    pageIncrement={60}
                    onValueChanged={setTimeValue}
                    onInput={handleTimeInput}
                    onOutput={handleTimeOutput}
                />
            </x.GridChild>
            <x.GridChild column={2} row={2}>
                <GtkLabel label={String(timeValue)} widthChars={10} xalign={1} />
            </x.GridChild>

            <x.GridChild column={0} row={3}>
                <GtkLabel label="_Month" useUnderline xalign={1} mnemonicWidget={monthSpinRef.current} />
            </x.GridChild>
            <x.GridChild column={1} row={3}>
                <GtkSpinButton
                    ref={monthSpinRef}
                    halign={Gtk.Align.START}
                    widthChars={9}
                    wrap
                    updatePolicy={Gtk.SpinButtonUpdatePolicy.IF_VALID}
                    value={monthValue}
                    lower={1}
                    upper={12}
                    stepIncrement={1}
                    pageIncrement={5}
                    onValueChanged={setMonthValue}
                    onInput={handleMonthInput}
                    onOutput={handleMonthOutput}
                />
            </x.GridChild>
            <x.GridChild column={2} row={3}>
                <GtkLabel label={String(monthValue)} widthChars={10} xalign={1} />
            </x.GridChild>
        </GtkGrid>
    );
};

export const spinbuttonDemo: Demo = {
    id: "spinbutton",
    title: "Spin Buttons",
    description:
        "GtkSpinButton provides convenient ways to input data that can be seen as a value in a range. The examples here show that this does not necessarily mean numeric values, and it can include custom formatting.",
    keywords: ["spin", "number", "input", "numeric", "GtkSpinButton", "integer", "float", "time", "month", "hex"],
    component: SpinButtonDemo,
    sourceCode,
};
