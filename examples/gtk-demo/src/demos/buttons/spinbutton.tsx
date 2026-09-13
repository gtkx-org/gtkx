import * as Gtk from "@gtkx/gi/gtk";
import { GtkAdjustment, GtkGrid, GtkGridLayoutChild, GtkLabel, GtkSpinButton } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./spinbutton.tsx?raw";

type SpinRowProps = {
    value: number;
    setValue: (v: number) => void;
};

type SpinRowConfig = {
    row: number;
    label: string;
    spinName: string;
    adjustment: Omit<React.ComponentProps<typeof GtkAdjustment>, "value">;
    spin: React.ComponentProps<typeof GtkSpinButton>;
} & SpinRowProps;

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
const DECIMAL_PREFIX_PATTERN = /^\s*([+-]?\d+)/;

const spinbuttonDemo: Demo = {
    id: "spinbutton",
    title: "Spin Buttons",
    description:
        "GtkSpinButton provides convenient ways to input data that can be seen as a value in a range. " +
        "The examples here show that this does not necessarily mean numeric values, " +
        "and it can include custom formatting.",
    keywords: ["GtkEntry"],
    component: SpinButtonDemo,
    sourceCode,
    isResizable: false,
};

const parseDecimal = (text: string): number => {
    const match = DECIMAL_PREFIX_PATTERN.exec(text);

    return match ? Number(match[1]) : NaN;
};

const isValidTimeOfDay = (hours: number, minutes: number): boolean =>
    !Number.isNaN(hours) && !Number.isNaN(minutes) && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;

const parseTimeOfDay = (text: string): number | null => {
    const parts = text.split(":");

    if (parts.length !== 2) {
        return null;
    }

    const hours = parseDecimal(parts[0] ?? "");
    const minutes = parseDecimal(parts[1] ?? "");

    if (!isValidTimeOfDay(hours, minutes)) {
        return null;
    }

    return hours * 60 + minutes;
};

const handleHexInput = (spin: Gtk.SpinButton): [number, number] => {
    const text = spin.getText();
    const match = /^\s*([+-]?)(?:0[xX])?([0-9a-fA-F]+)$/.exec(text);

    if (!match) {
        return [GTK_INPUT_ERROR, 0];
    }

    const sign = match[1] === "-" ? -1 : 1;
    const parsed = sign * Number.parseInt(match[2] ?? "", 16);

    if (Number.isNaN(parsed)) {
        return [GTK_INPUT_ERROR, 0];
    }

    return [1, parsed];
};

const handleHexOutput = (spin: Gtk.SpinButton) => {
    const value = spin.getValue();
    const text = Math.abs(value) < 1e-5 ? "0x00" : `0x${Math.round(value).toString(16).toUpperCase().padStart(2, "0")}`;
    spin.setText(text);

    return true;
};

const handleTimeInput = (spin: Gtk.SpinButton): [number, number] => {
    const minutesSinceMidnight = parseTimeOfDay(spin.getText());

    if (minutesSinceMidnight === null) {
        return [GTK_INPUT_ERROR, 0];
    }

    return [1, minutesSinceMidnight];
};

const handleTimeOutput = (spin: Gtk.SpinButton) => {
    const value = spin.getValue();
    const hours = Math.floor(value / 60);
    const minutes = Math.round((value / 60 - hours) * 60);
    spin.setText(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);

    return true;
};

const handleMonthInput = (spin: Gtk.SpinButton): [number, number] => {
    const text = spin.getText().toLowerCase();

    for (const [i, month] of MONTHS.entries()) {
        if (month.toLowerCase().startsWith(text)) {
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

const SpinRow = ({ row, label, spinName, value, setValue, adjustment, spin }: SpinRowConfig) => {
    const [spinWidget, setSpinWidget] = useState<Gtk.SpinButton | null>(null);

    return (
        <>
            <GtkGridLayoutChild column={0} row={row}>
                <GtkLabel useUnderline xalign={1} mnemonicWidget={spinWidget}>
                    {label}
                </GtkLabel>
            </GtkGridLayoutChild>
            <GtkGridLayoutChild column={1} row={row}>
                <GtkSpinButton
                    ref={(node) => {
                        setSpinWidget(node);
                    }}
                    name={spinName}
                    halign={Gtk.Align.START}
                    adjustment={<GtkAdjustment {...adjustment} value={value} />}
                    onValueChanged={(widget) => {
                        setValue(widget.getValue());
                    }}
                    {...spin}
                />
            </GtkGridLayoutChild>
            <GtkGridLayoutChild column={2} row={row}>
                <GtkLabel widthChars={10} xalign={1}>
                    {String(value)}
                </GtkLabel>
            </GtkGridLayoutChild>
        </>
    );
};

const NumericSpinRow = (props: SpinRowProps) => (
    <SpinRow
        {...props}
        row={0}
        label="_Numeric"
        spinName="basic_spin"
        adjustment={{ lower: -10_000, upper: 10_000, stepIncrement: 0.5, pageIncrement: 100 }}
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

const MonthSpinRow = (props: SpinRowProps) => (
    <SpinRow
        {...props}
        row={3}
        label="_Month"
        spinName="month_spin"
        adjustment={{ lower: 1, upper: 12, stepIncrement: 1, pageIncrement: 5 }}
        spin={{
            widthChars: 9,
            wrap: true,
            updatePolicy: Gtk.SpinButtonUpdatePolicy.IF_VALID,
            onInput: handleMonthInput,
            onOutput: handleMonthOutput,
        }}
    />
);

function SpinButtonDemo() {
    const [numericValue, setNumericValue] = useState(0);
    const [hexValue, setHexValue] = useState(0);
    const [timeValue, setTimeValue] = useState(0);
    const [monthValue, setMonthValue] = useState(1);

    return (
        <GtkGrid rowSpacing={10} columnSpacing={10} marginStart={20} marginEnd={20} marginTop={20} marginBottom={20}>
            <NumericSpinRow value={numericValue} setValue={setNumericValue} />
            <HexSpinRow value={hexValue} setValue={setHexValue} />
            <TimeSpinRow value={timeValue} setValue={setTimeValue} />
            <MonthSpinRow value={monthValue} setValue={setMonthValue} />
        </GtkGrid>
    );
}

export { spinbuttonDemo };
