import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label, SpinButton } from "@gtkx/react";
import { useRef, useState } from "react";
import type { Demo } from "../types.js";

export const SpinButtonDemo = () => {
    const intAdjustment = useRef(
        new Gtk.Adjustment({ value: 50, lower: 0, upper: 100, stepIncrement: 1, pageIncrement: 10 }),
    );
    const floatAdjustment = useRef(
        new Gtk.Adjustment({ value: 3.14, lower: 0, upper: 10, stepIncrement: 0.1, pageIncrement: 1 }),
    );
    const priceAdjustment = useRef(
        new Gtk.Adjustment({ value: 9.99, lower: 0, upper: 1000, stepIncrement: 0.01, pageIncrement: 1 }),
    );

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
                        adjustment={intAdjustment.current}
                        digits={0}
                        onValueChanged={() => setIntValue(intAdjustment.current.getValue())}
                    />
                    <Label.Root label={`Value: ${intValue}`} />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Floating Point (0-10, step 0.1)" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <SpinButton
                        climbRate={1}
                        adjustment={floatAdjustment.current}
                        digits={2}
                        onValueChanged={() => setFloatValue(floatAdjustment.current.getValue())}
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
                        adjustment={priceAdjustment.current}
                        digits={2}
                        onValueChanged={() => setPriceValue(priceAdjustment.current.getValue())}
                    />
                    <Label.Root label={`Total: $${priceValue.toFixed(2)}`} />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Wrap Around" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <SpinButton climbRate={1} adjustment={intAdjustment.current} digits={0} wrap />
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
    source: `const SpinButtonDemo = () => {
    const adjustment = useRef(new Gtk.Adjustment({
        value: 50, lower: 0, upper: 100,
        stepIncrement: 1, pageIncrement: 10
    }));
    const [value, setValue] = useState(50);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <SpinButton
                adjustment={adjustment.current}
                digits={0}
                onValueChanged={() => setValue(adjustment.current.getValue())}
            />
            <Label.Root label={\`Value: \${value}\`} />
        </Box>
    );
};`,
};
