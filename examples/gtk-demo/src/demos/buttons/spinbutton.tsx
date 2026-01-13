import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkLabel, GtkSpinButton } from "@gtkx/react";
import { useMemo, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./spinbutton.tsx?raw";

const SpinButtonDemo = () => {
    const [basicValue, setBasicValue] = useState(50);
    const [floatValue, setFloatValue] = useState(2.5);
    const [hours, setHours] = useState(12);
    const [minutes, setMinutes] = useState(0);
    const [seconds, setSeconds] = useState(0);

    const basicAdjustment = useMemo(() => new Gtk.Adjustment(50, 0, 100, 1, 10, 0), []);
    const floatAdjustment = useMemo(() => new Gtk.Adjustment(2.5, 0, 10, 0.1, 1, 0), []);
    const hoursAdjustment = useMemo(() => new Gtk.Adjustment(12, 0, 23, 1, 6, 0), []);
    const minutesAdjustment = useMemo(() => new Gtk.Adjustment(0, 0, 59, 1, 10, 0), []);
    const secondsAdjustment = useMemo(() => new Gtk.Adjustment(0, 0, 59, 1, 10, 0), []);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Spin Button" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GtkSpinButton allows numeric input with increment/decrement buttons. It supports integer and floating-point values with configurable ranges and step sizes."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Basic Integer">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={12}>
                        <GtkLabel label="Value (0-100):" halign={Gtk.Align.START} hexpand />
                        <GtkSpinButton
                            value={basicValue}
                            onValueChanged={(spinButton: Gtk.SpinButton) => setBasicValue(spinButton.getValue())}
                            adjustment={basicAdjustment}
                            digits={0}
                            climbRate={1}
                        />
                    </GtkBox>
                    <GtkLabel
                        label={`Current value: ${basicValue}`}
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Floating Point">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={12}>
                        <GtkLabel label="Value (0.0-10.0):" halign={Gtk.Align.START} hexpand />
                        <GtkSpinButton
                            value={floatValue}
                            onValueChanged={(spinButton: Gtk.SpinButton) => setFloatValue(spinButton.getValue())}
                            adjustment={floatAdjustment}
                            digits={2}
                            climbRate={0.1}
                        />
                    </GtkBox>
                    <GtkLabel
                        label={`Current value: ${floatValue.toFixed(2)}`}
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Time Input">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={6} halign={Gtk.Align.CENTER}>
                        <GtkSpinButton
                            value={hours}
                            onValueChanged={(spinButton: Gtk.SpinButton) => setHours(spinButton.getValue())}
                            adjustment={hoursAdjustment}
                            digits={0}
                            climbRate={1}
                            wrap
                            widthChars={2}
                        />
                        <GtkLabel label=":" />
                        <GtkSpinButton
                            value={minutes}
                            onValueChanged={(spinButton: Gtk.SpinButton) => setMinutes(spinButton.getValue())}
                            adjustment={minutesAdjustment}
                            digits={0}
                            climbRate={1}
                            wrap
                            widthChars={2}
                        />
                        <GtkLabel label=":" />
                        <GtkSpinButton
                            value={seconds}
                            onValueChanged={(spinButton: Gtk.SpinButton) => setSeconds(spinButton.getValue())}
                            adjustment={secondsAdjustment}
                            digits={0}
                            climbRate={1}
                            wrap
                            widthChars={2}
                        />
                    </GtkBox>
                    <GtkLabel
                        label={`Time: ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`}
                        halign={Gtk.Align.CENTER}
                        cssClasses={["dim-label"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const spinbuttonDemo: Demo = {
    id: "spinbutton",
    title: "Spin Button",
    description: "Numeric input with increment/decrement buttons",
    keywords: ["spin", "number", "input", "numeric", "GtkSpinButton", "integer", "float", "time"],
    component: SpinButtonDemo,
    sourceCode,
};
