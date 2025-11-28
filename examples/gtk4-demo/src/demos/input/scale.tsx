import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label, Scale } from "@gtkx/react";
import { useRef, useState } from "react";
import type { Demo } from "../types.js";

export const ScaleDemo = () => {
    const volumeAdjustment = useRef(
        new Gtk.Adjustment({ value: 50, lower: 0, upper: 100, stepIncrement: 1, pageIncrement: 10 }),
    );
    const brightnessAdjustment = useRef(
        new Gtk.Adjustment({ value: 75, lower: 0, upper: 100, stepIncrement: 5, pageIncrement: 10 }),
    );
    const temperatureAdjustment = useRef(
        new Gtk.Adjustment({ value: 20, lower: 10, upper: 30, stepIncrement: 0.5, pageIncrement: 2 }),
    );

    const [volume, setVolume] = useState(50);
    const [brightness, setBrightness] = useState(75);
    const [temperature, setTemperature] = useState(20);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Scale" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Horizontal Scale with Value" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <Label.Root label="Volume:" widthRequest={80} />
                    <Scale
                        orientation={Gtk.Orientation.HORIZONTAL}
                        hexpand
                        drawValue
                        adjustment={volumeAdjustment.current}
                        onValueChanged={() => setVolume(volumeAdjustment.current.getValue())}
                    />
                </Box>
                <Label.Root label={`Current volume: ${Math.round(volume)}%`} cssClasses={["dim-label"]} />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Scale with Marks" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <Label.Root label="Brightness:" widthRequest={80} />
                    <Scale
                        orientation={Gtk.Orientation.HORIZONTAL}
                        hexpand
                        drawValue
                        adjustment={brightnessAdjustment.current}
                        onValueChanged={() => setBrightness(brightnessAdjustment.current.getValue())}
                    />
                </Box>
                <Label.Root label={`Current brightness: ${Math.round(brightness)}%`} cssClasses={["dim-label"]} />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Fine-grained Control" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <Label.Root label="Temp:" widthRequest={80} />
                    <Scale
                        orientation={Gtk.Orientation.HORIZONTAL}
                        hexpand
                        drawValue
                        digits={1}
                        adjustment={temperatureAdjustment.current}
                        onValueChanged={() => setTemperature(temperatureAdjustment.current.getValue())}
                    />
                </Box>
                <Label.Root label={`Temperature: ${temperature.toFixed(1)}°C`} cssClasses={["dim-label"]} />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Vertical Scale" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={20} halign={Gtk.Align.CENTER}>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
                        <Scale
                            orientation={Gtk.Orientation.VERTICAL}
                            heightRequest={150}
                            inverted
                            drawValue
                            adjustment={volumeAdjustment.current}
                        />
                        <Label.Root label="Vol" cssClasses={["dim-label"]} />
                    </Box>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
                        <Scale
                            orientation={Gtk.Orientation.VERTICAL}
                            heightRequest={150}
                            inverted
                            drawValue
                            adjustment={brightnessAdjustment.current}
                        />
                        <Label.Root label="Bright" cssClasses={["dim-label"]} />
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export const scaleDemo: Demo = {
    id: "scale",
    title: "Scale",
    description: "Slider widget for selecting a value from a range.",
    keywords: ["scale", "slider", "range", "adjustment", "GtkScale"],
    component: ScaleDemo,
    source: `const ScaleDemo = () => {
    const adjustment = useRef(new Gtk.Adjustment({
        value: 50, lower: 0, upper: 100,
        stepIncrement: 1, pageIncrement: 10
    }));
    const [value, setValue] = useState(50);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <Scale
                hexpand
                drawValue
                adjustment={adjustment.current}
                onValueChanged={() => setValue(adjustment.current.getValue())}
            />
            <Label.Root label={\`Value: \${Math.round(value)}%\`} />
        </Box>
    );
};`,
};
