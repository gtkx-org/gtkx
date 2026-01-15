import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkGrid, GtkLabel, GtkSpinButton, x } from "@gtkx/react";
import { useCallback, useState } from "react";
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

const SpinButtonDemo = () => {
    const [numericValue, setNumericValue] = useState(0);
    const [hexValue, setHexValue] = useState(0);
    const [timeValue, setTimeValue] = useState(0);
    const [monthValue, setMonthValue] = useState(1);

    const formatHex = useCallback((value: number) => {
        if (Math.abs(value) < 1e-5) {
            return "0x00";
        }
        return `0x${Math.round(value).toString(16).toUpperCase().padStart(2, "0")}`;
    }, []);

    const formatTime = useCallback((value: number) => {
        const hours = Math.floor(value / 60);
        const minutes = Math.round((value / 60 - hours) * 60);
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }, []);

    const formatMonth = useCallback((value: number) => {
        const index = Math.round(value) - 1;
        return MONTHS[index] ?? "January";
    }, []);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkGrid rowSpacing={10} columnSpacing={10}>
                <x.GridChild column={0} row={0}>
                    <GtkLabel label="_Numeric" useUnderline xalign={1} />
                </x.GridChild>
                <x.GridChild column={1} row={0}>
                    <GtkSpinButton halign={Gtk.Align.START} widthChars={5} digits={2} climbRate={1} numeric>
                        <x.Adjustment
                            value={numericValue}
                            lower={-10000}
                            upper={10000}
                            stepIncrement={0.5}
                            pageIncrement={100}
                            onValueChanged={setNumericValue}
                        />
                    </GtkSpinButton>
                </x.GridChild>
                <x.GridChild column={2} row={0}>
                    <GtkLabel label={String(numericValue)} widthChars={10} xalign={1} />
                </x.GridChild>

                <x.GridChild column={0} row={1}>
                    <GtkLabel label="_Hexadecimal" useUnderline xalign={1} />
                </x.GridChild>
                <x.GridChild column={1} row={1}>
                    <GtkSpinButton halign={Gtk.Align.START} widthChars={4} wrap text={formatHex(hexValue)}>
                        <x.Adjustment
                            value={hexValue}
                            lower={0}
                            upper={255}
                            stepIncrement={1}
                            pageIncrement={16}
                            onValueChanged={setHexValue}
                        />
                    </GtkSpinButton>
                </x.GridChild>
                <x.GridChild column={2} row={1}>
                    <GtkLabel label={String(hexValue)} widthChars={10} xalign={1} />
                </x.GridChild>

                <x.GridChild column={0} row={2}>
                    <GtkLabel label="_Time" useUnderline xalign={1} />
                </x.GridChild>
                <x.GridChild column={1} row={2}>
                    <GtkSpinButton halign={Gtk.Align.START} widthChars={5} wrap text={formatTime(timeValue)}>
                        <x.Adjustment
                            value={timeValue}
                            lower={0}
                            upper={1410}
                            stepIncrement={30}
                            pageIncrement={60}
                            onValueChanged={setTimeValue}
                        />
                    </GtkSpinButton>
                </x.GridChild>
                <x.GridChild column={2} row={2}>
                    <GtkLabel label={String(timeValue)} widthChars={10} xalign={1} />
                </x.GridChild>

                <x.GridChild column={0} row={3}>
                    <GtkLabel label="_Month" useUnderline xalign={1} />
                </x.GridChild>
                <x.GridChild column={1} row={3}>
                    <GtkSpinButton
                        halign={Gtk.Align.START}
                        widthChars={9}
                        wrap
                        updatePolicy={Gtk.SpinButtonUpdatePolicy.IF_VALID}
                        text={formatMonth(monthValue)}
                    >
                        <x.Adjustment
                            value={monthValue}
                            lower={1}
                            upper={12}
                            stepIncrement={1}
                            pageIncrement={5}
                            onValueChanged={setMonthValue}
                        />
                    </GtkSpinButton>
                </x.GridChild>
                <x.GridChild column={2} row={3}>
                    <GtkLabel label={String(monthValue)} widthChars={10} xalign={1} />
                </x.GridChild>
            </GtkGrid>
        </GtkBox>
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
