import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkScale } from "@gtkx/react";
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
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Scale" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Horizontal <GtkScale with Value" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkLabel label="Volume:" widthRequest={80} />
                    <GtkScale
                        orientation={Gtk.Orientation.HORIZONTAL}
                        hexpand
                        drawValue
                        adjustment={volumeAdjustment}
                        onValueChanged={(self) => setVolume(self.getValue())}
                    />
                </GtkBox>
                <GtkLabel label={`Current volume: ${Math.round(volume)}%`} cssClasses={["dim-label"]} />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="<GtkScale with Marks" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkLabel label="Brightness:" widthRequest={80} />
                    <GtkScale
                        orientation={Gtk.Orientation.HORIZONTAL}
                        hexpand
                        drawValue
                        adjustment={brightnessAdjustment}
                        onValueChanged={(self) => setBrightness(self.getValue())}
                    />
                </GtkBox>
                <GtkLabel label={`Current brightness: ${Math.round(brightness)}%`} cssClasses={["dim-label"]} />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Fine-grained Control" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkLabel label="Temp:" widthRequest={80} />
                    <GtkScale
                        orientation={Gtk.Orientation.HORIZONTAL}
                        hexpand
                        drawValue
                        digits={1}
                        adjustment={temperatureAdjustment}
                        onValueChanged={(self) => setTemperature(self.getValue())}
                    />
                </GtkBox>
                <GtkLabel label={`Temperature: ${temperature.toFixed(1)}°C`} cssClasses={["dim-label"]} />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Vertical Scale" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={20} halign={Gtk.Align.CENTER}>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
                        <GtkScale
                            orientation={Gtk.Orientation.VERTICAL}
                            heightRequest={150}
                            inverted
                            drawValue
                            adjustment={volumeAdjustment}
                        />
                        <GtkLabel label="Vol" cssClasses={["dim-label"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
                        <GtkScale
                            orientation={Gtk.Orientation.VERTICAL}
                            heightRequest={150}
                            inverted
                            drawValue
                            adjustment={brightnessAdjustment}
                        />
                        <GtkLabel label="Bright" cssClasses={["dim-label"]} />
                    </GtkBox>
                </GtkBox>
            </GtkBox>
        </GtkBox>
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
