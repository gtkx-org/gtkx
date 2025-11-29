import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label, SpinButton } from "@gtkx/react";
import { useMemo, useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

export const SpinButtonDemo = () => {
    const intAdjustment = useMemo(() => new Gtk.Adjustment(50, 0, 100, 1, 10, 0), []);
    const floatAdjustment = useMemo(() => new Gtk.Adjustment(3.14, 0, 10, 0.1, 1, 0), []);
    const priceAdjustment = useMemo(() => new Gtk.Adjustment(9.99, 0, 1000, 0.01, 1, 0), []);

    const [intValue, setIntValue] = useState(50);
    const [floatValue, setFloatValue] = useState(3.14);
    const [priceValue, setPriceValue] = useState(9.99);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Spin Button" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Integer Values (0-100)" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <SpinButton
                        climbRate={1}
                        adjustment={intAdjustment}
                        digits={0}
                        onValueChanged={(self) => setIntValue(self.getValue())}
                    />
                    <Label.Root label={`Value: ${intValue}`} />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Floating Point (0-10, step 0.1)" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <SpinButton
                        climbRate={1}
                        adjustment={floatAdjustment}
                        digits={2}
                        onValueChanged={(self) => setFloatValue(self.getValue())}
                    />
                    <Label.Root label={`Value: ${floatValue.toFixed(2)}`} />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Price Input (step 0.01)" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <Label.Root label="$" />
                    <SpinButton
                        climbRate={1}
                        adjustment={priceAdjustment}
                        digits={2}
                        onValueChanged={(self) => setPriceValue(self.getValue())}
                    />
                    <Label.Root label={`Total: $${priceValue.toFixed(2)}`} />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Wrap Around" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <SpinButton climbRate={1} adjustment={intAdjustment} digits={0} wrap />
                <Label.Root
                    label="This spin button wraps from max to min and vice versa"
                    cssClasses={["dim-label"]}
                    wrap
                />
            </Box>
        </Box>
    );
};

export const spinButtonDemo: Demo = {
    id: "spin-button",
    title: "Spin Button",
    description: "Numeric input with increment/decrement buttons.",
    keywords: ["spin", "button", "number", "input", "adjustment", "GtkSpinButton"],
    component: SpinButtonDemo,
    sourcePath: getSourcePath(import.meta.url, "spin-button.tsx"),
};
