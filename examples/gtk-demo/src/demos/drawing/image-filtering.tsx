import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkImage, GtkLabel, GtkScale, x } from "@gtkx/react";
import { useCallback, useMemo, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./image-filtering.tsx?raw";

interface FilterState {
    brightness: number;
    contrast: number;
    saturation: number;
    sepia: number;
    invert: number;
    hueRotate: number;
    blur: number;
}

const DEFAULT_FILTERS: FilterState = {
    brightness: 1,
    contrast: 1,
    saturation: 1,
    sepia: 0,
    invert: 0,
    hueRotate: 0,
    blur: 0,
};

const FilterSlider = ({
    label,
    value,
    min,
    max,
    step,
    defaultValue,
    onChange,
    unit = "",
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    defaultValue: number;
    onChange: (value: number) => void;
    unit?: string;
}) => (
    <GtkBox spacing={8}>
        <GtkLabel label={label} widthRequest={100} xalign={1} cssClasses={["dim-label"]} />
        <GtkScale hexpand digits={step < 1 ? 1 : 0} drawValue>
            <x.Adjustment
                value={value}
                lower={min}
                upper={max}
                stepIncrement={step}
                pageIncrement={step * 10}
                onValueChanged={onChange}
            />
        </GtkScale>
        <GtkLabel
            label={`${value.toFixed(step < 1 ? 1 : 0)}${unit}`}
            widthRequest={60}
            xalign={0}
            cssClasses={["monospace", "dim-label"]}
        />
        <GtkButton
            iconName="edit-undo-symbolic"
            cssClasses={["flat", "circular"]}
            sensitive={value !== defaultValue}
            onClicked={() => onChange(defaultValue)}
            tooltipText="Reset"
        />
    </GtkBox>
);

const ImageFilteringDemo = () => {
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

    const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    }, []);

    const resetAll = useCallback(() => {
        setFilters(DEFAULT_FILTERS);
    }, []);

    const filterClass = useMemo(() => {
        const filterValue = [
            `brightness(${filters.brightness})`,
            `contrast(${filters.contrast})`,
            `saturate(${filters.saturation})`,
            `sepia(${filters.sepia})`,
            `invert(${filters.invert})`,
            `hue-rotate(${filters.hueRotate}deg)`,
            `blur(${filters.blur}px)`,
        ].join(" ");
        return css({ filter: filterValue });
    }, [filters]);

    const hasChanges = Object.keys(DEFAULT_FILTERS).some(
        (key) => filters[key as keyof FilterState] !== DEFAULT_FILTERS[key as keyof FilterState],
    );

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={16}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                <GtkLabel label="Image Filtering" cssClasses={["title-2"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GPU-accelerated image filters using GTK CSS. These filters are applied via GSK render nodes for hardware-accelerated rendering."
                    wrap
                    halign={Gtk.Align.START}
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox spacing={16} vexpand>
                <GtkFrame label="Preview" hexpand>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        halign={Gtk.Align.CENTER}
                        valign={Gtk.Align.CENTER}
                        marginTop={16}
                        marginBottom={16}
                        marginStart={16}
                        marginEnd={16}
                        vexpand
                    >
                        <GtkImage iconName="org.gtk.Demo4" pixelSize={256} cssClasses={[filterClass]} />
                    </GtkBox>
                </GtkFrame>

                <GtkFrame label="Filters" widthRequest={400}>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={8}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <FilterSlider
                            label="Brightness"
                            value={filters.brightness}
                            min={0}
                            max={2}
                            step={0.1}
                            defaultValue={DEFAULT_FILTERS.brightness}
                            onChange={(v) => updateFilter("brightness", v)}
                        />
                        <FilterSlider
                            label="Contrast"
                            value={filters.contrast}
                            min={0}
                            max={2}
                            step={0.1}
                            defaultValue={DEFAULT_FILTERS.contrast}
                            onChange={(v) => updateFilter("contrast", v)}
                        />
                        <FilterSlider
                            label="Saturation"
                            value={filters.saturation}
                            min={0}
                            max={2}
                            step={0.1}
                            defaultValue={DEFAULT_FILTERS.saturation}
                            onChange={(v) => updateFilter("saturation", v)}
                        />
                        <FilterSlider
                            label="Sepia"
                            value={filters.sepia}
                            min={0}
                            max={1}
                            step={0.1}
                            defaultValue={DEFAULT_FILTERS.sepia}
                            onChange={(v) => updateFilter("sepia", v)}
                        />
                        <FilterSlider
                            label="Invert"
                            value={filters.invert}
                            min={0}
                            max={1}
                            step={0.1}
                            defaultValue={DEFAULT_FILTERS.invert}
                            onChange={(v) => updateFilter("invert", v)}
                        />
                        <FilterSlider
                            label="Hue Rotate"
                            value={filters.hueRotate}
                            min={0}
                            max={360}
                            step={1}
                            defaultValue={DEFAULT_FILTERS.hueRotate}
                            onChange={(v) => updateFilter("hueRotate", v)}
                            unit="°"
                        />
                        <FilterSlider
                            label="Blur"
                            value={filters.blur}
                            min={0}
                            max={20}
                            step={0.5}
                            defaultValue={DEFAULT_FILTERS.blur}
                            onChange={(v) => updateFilter("blur", v)}
                            unit="px"
                        />

                        <GtkBox marginTop={8} halign={Gtk.Align.END}>
                            <GtkButton label="Reset All" sensitive={hasChanges} onClicked={resetAll} />
                        </GtkBox>
                    </GtkBox>
                </GtkFrame>
            </GtkBox>

            <GtkFrame label="How It Works">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="GTK's CSS filter property maps directly to GSK render nodes:"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkBox spacing={24} halign={Gtk.Align.CENTER} marginTop={8}>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                            <GtkLabel label="brightness(), contrast()" cssClasses={["monospace", "caption"]} />
                            <GtkLabel label="→ ColorMatrixNode" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                            <GtkLabel label="saturate(), sepia()" cssClasses={["monospace", "caption"]} />
                            <GtkLabel label="→ ColorMatrixNode" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                            <GtkLabel label="blur()" cssClasses={["monospace", "caption"]} />
                            <GtkLabel label="→ BlurNode" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                            <GtkLabel label="hue-rotate()" cssClasses={["monospace", "caption"]} />
                            <GtkLabel label="→ ColorMatrixNode" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const imageFilteringDemo: Demo = {
    id: "image-filtering",
    title: "Image Filtering",
    description: "GPU-accelerated image filters using CSS and GSK render nodes",
    keywords: ["image", "filter", "blur", "brightness", "contrast", "saturation", "sepia", "gsk", "css"],
    component: ImageFilteringDemo,
    sourceCode,
};
