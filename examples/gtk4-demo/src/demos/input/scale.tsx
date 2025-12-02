import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label, Scale } from "@gtkx/react";
import { useMemo, useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const ScaleDemo = () => {
    const volumeAdjustment = useMemo(() => new Gtk.Adjustment(50, 0, 100, 1, 10, 0), []);
    const brightnessAdjustment = useMemo(() => new Gtk.Adjustment(75, 0, 100, 5, 10, 0), []);
    const temperatureAdjustment = useMemo(() => new Gtk.Adjustment(20, 10, 30, 0.5, 2, 0), []);

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
                        adjustment={volumeAdjustment}
                        onValueChanged={(self) => setVolume(self.getValue())}
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
                        adjustment={brightnessAdjustment}
                        onValueChanged={(self) => setBrightness(self.getValue())}
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
                        adjustment={temperatureAdjustment}
                        onValueChanged={(self) => setTemperature(self.getValue())}
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
                            adjustment={volumeAdjustment}
                        />
                        <Label.Root label="Vol" cssClasses={["dim-label"]} />
                    </Box>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
                        <Scale
                            orientation={Gtk.Orientation.VERTICAL}
                            heightRequest={150}
                            inverted
                            drawValue
                            adjustment={brightnessAdjustment}
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
    sourcePath: getSourcePath(import.meta.url, "scale.tsx"),
};
