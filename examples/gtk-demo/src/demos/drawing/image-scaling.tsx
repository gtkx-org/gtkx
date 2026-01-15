import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkFrame,
    GtkImage,
    GtkLabel,
    GtkScale,
    GtkScrolledWindow,
    GtkToggleButton,
    x,
} from "@gtkx/react";
import { useCallback, useMemo, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./image-scaling.tsx?raw";

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] as const;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

const SCALING_FILTERS = [
    { id: "linear", name: "Linear", description: "Smooth interpolation (default)" },
    { id: "nearest", name: "Nearest", description: "Sharp pixels, no interpolation" },
    { id: "trilinear", name: "Trilinear", description: "High quality with mipmaps" },
];

const ImageScalingDemo = () => {
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [filterIndex, setFilterIndex] = useState(0);
    const [fitMode, setFitMode] = useState(false);

    const handleZoomIn = useCallback(() => {
        setZoom((z) => {
            for (const level of ZOOM_LEVELS) {
                if (level > z) return level;
            }
            return 4;
        });
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoom((z) => {
            for (let i = ZOOM_LEVELS.length - 1; i >= 0; i--) {
                const level = ZOOM_LEVELS[i];
                if (level !== undefined && level < z) return level;
            }
            return 0.25;
        });
    }, []);

    const handleRotateLeft = useCallback(() => {
        setRotation((r) => (r - 90 + 360) % 360);
    }, []);

    const handleRotateRight = useCallback(() => {
        setRotation((r) => (r + 90) % 360);
    }, []);

    const handleReset = useCallback(() => {
        setZoom(1);
        setRotation(0);
        setFitMode(false);
    }, []);

    const imageClass = useMemo(() => {
        const transform = `scale(${zoom}) rotate(${rotation}deg)`;
        const filter = SCALING_FILTERS[filterIndex];
        const isNearest = filter?.id === "nearest";
        return css`
            transform: ${transform};
            image-rendering: ${isNearest ? "crisp-edges" : "auto"};
            transition-property: transform;
            transition-duration: 150ms;
        `;
    }, [zoom, rotation, filterIndex]);

    const zoomPercent = Math.round(zoom * 100);
    const hasChanges = zoom !== 1 || rotation !== 0;

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={16}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                <GtkLabel label="Image Scaling" cssClasses={["title-2"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Interactive image viewer with zoom, rotation, and scaling filter controls. The viewer demonstrates GPU-accelerated transformations via CSS."
                    wrap
                    halign={Gtk.Align.START}
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
                <GtkBox cssClasses={["linked"]}>
                    <GtkButton
                        iconName="zoom-out-symbolic"
                        tooltipText="Zoom Out"
                        onClicked={handleZoomOut}
                        sensitive={zoom > MIN_ZOOM}
                    />
                    <GtkButton
                        label={`${zoomPercent}%`}
                        widthRequest={70}
                        tooltipText="Reset Zoom"
                        onClicked={() => setZoom(1)}
                    />
                    <GtkButton
                        iconName="zoom-in-symbolic"
                        tooltipText="Zoom In"
                        onClicked={handleZoomIn}
                        sensitive={zoom < MAX_ZOOM}
                    />
                </GtkBox>

                <GtkBox cssClasses={["linked"]}>
                    <GtkButton
                        iconName="object-rotate-left-symbolic"
                        tooltipText="Rotate Left"
                        onClicked={handleRotateLeft}
                    />
                    <GtkButton
                        iconName="object-rotate-right-symbolic"
                        tooltipText="Rotate Right"
                        onClicked={handleRotateRight}
                    />
                </GtkBox>

                <GtkToggleButton
                    iconName="zoom-fit-best-symbolic"
                    tooltipText="Fit to View"
                    active={fitMode}
                    onClicked={() => setFitMode(!fitMode)}
                />

                <GtkButton
                    iconName="edit-undo-symbolic"
                    tooltipText="Reset"
                    onClicked={handleReset}
                    sensitive={hasChanges}
                />
            </GtkBox>

            <GtkFrame hexpand vexpand>
                <GtkScrolledWindow hexpand vexpand hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
                    <GtkBox halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} hexpand vexpand>
                        <GtkImage iconName="org.gtk.Demo4" pixelSize={fitMode ? 128 : 256} cssClasses={[imageClass]} />
                    </GtkBox>
                </GtkScrolledWindow>
            </GtkFrame>

            <GtkBox spacing={16}>
                <GtkFrame label="Zoom" hexpand>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={8}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <GtkScale digits={0} drawValue>
                            <x.Adjustment
                                value={zoom * 100}
                                lower={25}
                                upper={400}
                                stepIncrement={25}
                                pageIncrement={100}
                                onValueChanged={(v) => setZoom(v / 100)}
                            />
                        </GtkScale>
                        <GtkBox spacing={4} halign={Gtk.Align.CENTER}>
                            {ZOOM_LEVELS.map((level) => (
                                <GtkButton
                                    key={level}
                                    label={`${level * 100}%`}
                                    cssClasses={zoom === level ? ["suggested-action"] : ["flat"]}
                                    onClicked={() => setZoom(level)}
                                />
                            ))}
                        </GtkBox>
                    </GtkBox>
                </GtkFrame>

                <GtkFrame label="Rotation" hexpand>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={8}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <GtkScale digits={0} drawValue>
                            <x.Adjustment
                                value={rotation}
                                lower={0}
                                upper={360}
                                stepIncrement={15}
                                pageIncrement={90}
                                onValueChanged={setRotation}
                            />
                        </GtkScale>
                        <GtkBox spacing={4} halign={Gtk.Align.CENTER}>
                            {[0, 90, 180, 270].map((angle) => (
                                <GtkButton
                                    key={angle}
                                    label={`${angle}°`}
                                    cssClasses={rotation === angle ? ["suggested-action"] : ["flat"]}
                                    onClicked={() => setRotation(angle)}
                                />
                            ))}
                        </GtkBox>
                    </GtkBox>
                </GtkFrame>
            </GtkBox>

            <GtkFrame label="Scaling Filter">
                <GtkBox
                    spacing={16}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    {SCALING_FILTERS.map((filter, index) => (
                        <GtkBox key={filter.id} orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                            <GtkButton
                                label={filter.name}
                                cssClasses={filterIndex === index ? ["suggested-action"] : []}
                                onClicked={() => setFilterIndex(index)}
                            />
                            <GtkLabel label={filter.description} cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                    ))}
                </GtkBox>
            </GtkFrame>

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
                        label="GTK's CSS engine maps these properties to GSK render nodes:"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkBox spacing={24} halign={Gtk.Align.CENTER} marginTop={8}>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                            <GtkLabel label="transform: scale()" cssClasses={["monospace", "caption"]} />
                            <GtkLabel label="→ TransformNode" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                            <GtkLabel label="transform: rotate()" cssClasses={["monospace", "caption"]} />
                            <GtkLabel label="→ TransformNode" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                            <GtkLabel label="image-rendering" cssClasses={["monospace", "caption"]} />
                            <GtkLabel label="→ GskScalingFilter" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const imageScalingDemo: Demo = {
    id: "image-scaling",
    title: "Image Scaling",
    description: "Interactive image viewer with zoom, rotation, and scaling filter controls",
    keywords: ["image", "scaling", "zoom", "rotate", "transform", "gsk", "filter"],
    component: ImageScalingDemo,
    sourceCode,
};
