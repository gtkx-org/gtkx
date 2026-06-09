import * as Gtk from "@gtkx/gi/gtk";
import { type AdjustmentConfig, GtkGrid, GtkGridChild, GtkLabel, GtkSpinButton, useAdjustment } from "@gtkx/react";
import { useRef, useState } from "react";
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

const handleHexInput = (spin: Gtk.SpinButton): [number, number] => {
    const text = spin.getText();
    const match = text.match(/^\s*([+-]?)(?:0[xX])?([0-9a-fA-F]+)$/);
    if (!match) return [GTK_INPUT_ERROR, 0];
    const sign = match[1] === "-" ? -1 : 1;
    const parsed = sign * Number.parseInt(match[2] ?? "", 16);
    if (Number.isNaN(parsed)) return [GTK_INPUT_ERROR, 0];
    return [1, parsed];
};

const handleHexOutput = (spin: Gtk.SpinButton) => {
    const value = spin.getValue();
    const text = Math.abs(value) < 1e-5 ? "0x00" : `0x${Math.round(value).toString(16).toUpperCase().padStart(2, "0")}`;
    spin.setText(text);
    return true;
};

const handleTimeInput = (spin: Gtk.SpinButton): [number, number] => {
    const text = spin.getText();
    const parts = text.split(":");
    if (parts.length !== 2) return [GTK_INPUT_ERROR, 0];
    const hours = Number.parseInt(parts[0] ?? "", 10);
    const minutes = Number.parseInt(parts[1] ?? "", 10);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return [GTK_INPUT_ERROR, 0];
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return [GTK_INPUT_ERROR, 0];
    return [1, hours * 60 + minutes];
};

const handleTimeOutput = (spin: Gtk.SpinButton) => {
    const value = spin.getValue();
    const hours = Math.floor(value / 60);
    const minutes = Math.round((value / 60 - hours) * 60);
    spin.setText(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
    return true;
};

function useMonthSpinHandlers() {
    const handleMonthInput = (spin: Gtk.SpinButton): [number, number] => {
        const text = spin.getText().toLowerCase();
        for (let i = 0; i < MONTHS.length; i++) {
            if (MONTHS[i]?.toLowerCase().startsWith(text)) {
                return [1, i + 1];
            }
        }
        return [GTK_INPUT_ERROR, 0];
    };

    const handleMonthOutput = (spin: Gtk.SpinButton) => {
        const value = spin.getValue();
        const index = Math.round(value) - 1;
        spin.setText(MONTHS[index] ?? "January");
        return true;
    };

    return { handleMonthInput, handleMonthOutput };
}

interface SpinRowProps {
    value: number;
    setValue: (v: number) => void;
    spinRef: React.RefObject<Gtk.SpinButton | null>;
}

interface SpinRowConfig extends SpinRowProps {
    row: number;
    label: string;
    spinName: string;
    adjustment: AdjustmentConfig;
    spin: React.ComponentProps<typeof GtkSpinButton>;
}

const SpinRow = ({ row, label, spinName, value, setValue, spinRef, adjustment, spin }: SpinRowConfig) => {
    const adj = useAdjustment({ ...adjustment, value });
    return (
        <>
            <GtkGridChild column={0} row={row}>
                <GtkLabel label={label} useUnderline xalign={1} mnemonicWidget={spinRef.current} />
            </GtkGridChild>
            <GtkGridChild column={1} row={row}>
                <GtkSpinButton
                    ref={spinRef}
                    name={spinName}
                    halign={Gtk.Align.START}
                    adjustment={adj}
                    onValueChanged={(widget) => setValue(widget.getValue())}
                    {...spin}
                />
            </GtkGridChild>
            <GtkGridChild column={2} row={row}>
                <GtkLabel label={String(value)} widthChars={10} xalign={1} />
            </GtkGridChild>
        </>
    );
};

const NumericSpinRow = (props: SpinRowProps) => (
    <SpinRow
        {...props}
        row={0}
        label="_Numeric"
        spinName="basic_spin"
        adjustment={{ lower: -10000, upper: 10000, stepIncrement: 0.5, pageIncrement: 100 }}
        spin={{
            widthChars: 5,
            digits: 2,
            climbRate: 1,
            numeric: true,
        }}
    />
);

const HexSpinRow = (props: SpinRowProps) => (
    <SpinRow
        {...props}
        row={1}
        label="_Hexadecimal"
        spinName="hex_spin"
        adjustment={{ lower: 0, upper: 255, stepIncrement: 1, pageIncrement: 16 }}
        spin={{
            widthChars: 4,
            wrap: true,
            onInput: handleHexInput,
            onOutput: handleHexOutput,
        }}
    />
);

const TimeSpinRow = (props: SpinRowProps) => (
    <SpinRow
        {...props}
        row={2}
        label="_Time"
        spinName="time_spin"
        adjustment={{ lower: 0, upper: 1410, stepIncrement: 30, pageIncrement: 60 }}
        spin={{
            widthChars: 5,
            wrap: true,
            onInput: handleTimeInput,
            onOutput: handleTimeOutput,
        }}
    />
);

interface MonthSpinRowProps extends SpinRowProps {
    onInput: (spin: Gtk.SpinButton) => [number, number];
    onOutput: (spin: Gtk.SpinButton) => boolean;
}

const MonthSpinRow = ({ value, setValue, spinRef, onInput, onOutput }: MonthSpinRowProps) => (
    <SpinRow
        value={value}
        setValue={setValue}
        spinRef={spinRef}
        row={3}
        label="_Month"
        spinName="month_spin"
        adjustment={{ lower: 1, upper: 12, stepIncrement: 1, pageIncrement: 5 }}
        spin={{
            widthChars: 9,
            wrap: true,
            updatePolicy: Gtk.SpinButtonUpdatePolicy.IF_VALID,
            onInput,
            onOutput,
        }}
    />
);

const SpinButtonDemo = () => {
    const [numericValue, setNumericValue] = useState(0);
    const [hexValue, setHexValue] = useState(0);
    const [timeValue, setTimeValue] = useState(0);
    const [monthValue, setMonthValue] = useState(1);

    const numericSpinRef = useRef<Gtk.SpinButton | null>(null);
    const hexSpinRef = useRef<Gtk.SpinButton | null>(null);
    const timeSpinRef = useRef<Gtk.SpinButton | null>(null);
    const monthSpinRef = useRef<Gtk.SpinButton | null>(null);

    const monthHandlers = useMonthSpinHandlers();

    return (
        <GtkGrid rowSpacing={10} columnSpacing={10} marginStart={20} marginEnd={20} marginTop={20} marginBottom={20}>
            <NumericSpinRow value={numericValue} setValue={setNumericValue} spinRef={numericSpinRef} />
            <HexSpinRow value={hexValue} setValue={setHexValue} spinRef={hexSpinRef} />
            <TimeSpinRow value={timeValue} setValue={setTimeValue} spinRef={timeSpinRef} />
            <MonthSpinRow
                value={monthValue}
                setValue={setMonthValue}
                spinRef={monthSpinRef}
                onInput={monthHandlers.handleMonthInput}
                onOutput={monthHandlers.handleMonthOutput}
            />
        </GtkGrid>
    );
};

export const spinbuttonDemo: Demo = {
    id: "spinbutton",
    title: "Spin Buttons",
    description:
        "GtkSpinButton provides convenient ways to input data that can be seen as a value in a range. The examples here show that this does not necessarily mean numeric values, and it can include custom formatting.",
    keywords: ["GtkEntry"],
    component: SpinButtonDemo,
    sourceCode,
    resizable: false,
};
