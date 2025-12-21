import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkSpinButton } from "@gtkx/react";
import { useMemo, useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const SpinButtonDemo = () => {
    const intAdjustment = useMemo(() => new Gtk.Adjustment(50, 0, 100, 1, 10, 0), []);
    const floatAdjustment = useMemo(() => new Gtk.Adjustment(3.14, 0, 10, 0.1, 1, 0), []);
    const priceAdjustment = useMemo(() => new Gtk.Adjustment(9.99, 0, 1000, 0.01, 1, 0), []);

    const [intValue, setIntValue] = useState(50);
    const [floatValue, setFloatValue] = useState(3.14);
    const [priceValue, setPriceValue] = useState(9.99);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Spin GtkButton" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Integer Values (0-100)" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkSpinButton
                        climbRate={1}
                        adjustment={intAdjustment}
                        digits={0}
                        onValueChanged={(self) => setIntValue(self.getValue())}
                    />
                    <GtkLabel label={`Value: ${intValue}`} />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Floating Point (0-10, step 0.1)" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkSpinButton
                        climbRate={1}
                        adjustment={floatAdjustment}
                        digits={2}
                        onValueChanged={(self) => setFloatValue(self.getValue())}
                    />
                    <GtkLabel label={`Value: ${floatValue.toFixed(2)}`} />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Price Input (step 0.01)" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    $
                    <GtkSpinButton
                        climbRate={1}
                        adjustment={priceAdjustment}
                        digits={2}
                        onValueChanged={(self) => setPriceValue(self.getValue())}
                    />
                    <GtkLabel label={`Total: $${priceValue.toFixed(2)}`} />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Wrap Around" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkSpinButton climbRate={1} adjustment={intAdjustment} digits={0} wrap />
                <GtkLabel
                    label="This spin button wraps from max to min and vice versa"
                    cssClasses={["dim-label"]}
                    wrap
                />
            </GtkBox>
        </GtkBox>
    );
};

export const spinButtonDemo: Demo = {
    id: "spin-button",
    title: "Spin GtkButton",
    description: "Numeric input with increment/decrement buttons.",
    keywords: ["spin", "button", "number", "input", "adjustment", "GtkSpinButton"],
    component: SpinButtonDemo,
    sourcePath: getSourcePath(import.meta.url, "spin-button.tsx"),
};
