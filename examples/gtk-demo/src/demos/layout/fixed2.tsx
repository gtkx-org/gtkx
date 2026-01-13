import { css, cx } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFixed, GtkFrame, GtkLabel, GtkScale, x } from "@gtkx/react";
import { useEffect, useMemo, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./fixed2.tsx?raw";

const transformWidgetStyle = css`
 min-width: 50px;
 min-height: 50px;
 border-radius: 8px;
 font-size: 24px;
 font-weight: bold;
`;

const transformAccentStyle = css`
 background-color: @accent_bg_color;
 color: @accent_fg_color;
`;

const transformSuccessStyle = css`
 background-color: @success_bg_color;
 color: @success_fg_color;
`;

const transformWarningStyle = css`
 background-color: @warning_bg_color;
 color: @warning_fg_color;
`;

const transformErrorStyle = css`
 background-color: @error_bg_color;
 color: @error_fg_color;
`;

const transformSelectedStyle = css`
 outline: 3px solid @accent_color;
 outline-offset: 2px;
`;

const fixedContainerStyle = css`
 background: linear-gradient(135deg, alpha(@accent_color, 0.05), alpha(@accent_color, 0.02));
 border-radius: 12px;
`;

const zLayerStyle = css`
 padding: 4px 12px;
 border-radius: 4px;
 font-size: 11px;
`;

const zBackStyle = css`background-color: alpha(@accent_color, 0.2);`;
const zMiddleStyle = css`background-color: alpha(@accent_color, 0.4);`;
const zFrontStyle = css`background-color: alpha(@accent_color, 0.6);`;

const colorStyles: Record<string, string> = {
    accent: transformAccentStyle,
    success: transformSuccessStyle,
    warning: transformWarningStyle,
    error: transformErrorStyle,
};

interface TransformedWidget {
    id: string;
    label: string;
    x: number;
    y: number;
    rotation: number;
    scale: number;
    color: string;
}

const Fixed2Demo = () => {
    const [widgets, setWidgets] = useState<TransformedWidget[]>([
        { id: "1", label: "A", x: 50, y: 50, rotation: 0, scale: 1.0, color: "accent" },
        { id: "2", label: "B", x: 150, y: 80, rotation: 45, scale: 1.2, color: "success" },
        { id: "3", label: "C", x: 250, y: 50, rotation: -30, scale: 0.8, color: "warning" },
        { id: "4", label: "D", x: 100, y: 150, rotation: 90, scale: 1.0, color: "error" },
        { id: "5", label: "E", x: 200, y: 150, rotation: 180, scale: 1.5, color: "accent" },
    ]);
    const [selectedId, setSelectedId] = useState<string | null>("1");
    const [isAnimating, setIsAnimating] = useState(false);

    const rotationAdjustment = useMemo(() => new Gtk.Adjustment(0, -180, 180, 5, 15, 0), []);
    const scaleAdjustment = useMemo(() => new Gtk.Adjustment(1, 0.5, 2, 0.1, 0.25, 0), []);
    const xAdjustment = useMemo(() => new Gtk.Adjustment(100, 0, 350, 10, 50, 0), []);
    const yAdjustment = useMemo(() => new Gtk.Adjustment(100, 0, 200, 10, 50, 0), []);

    const selectedWidget = widgets.find((w) => w.id === selectedId);

    useEffect(() => {
        if (!isAnimating) return;

        const interval = setInterval(() => {
            setWidgets((prev) =>
                prev.map((w) => ({
                    ...w,
                    rotation: (w.rotation + 2) % 360,
                })),
            );
        }, 50);

        return () => clearInterval(interval);
    }, [isAnimating]);

    const updateWidget = (id: string, updates: Partial<TransformedWidget>) => {
        setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)));
    };

    const handleSelect = (id: string) => {
        setSelectedId(id);
        const widget = widgets.find((w) => w.id === id);
        if (widget) {
            rotationAdjustment.setValue(widget.rotation);
            scaleAdjustment.setValue(widget.scale);
            xAdjustment.setValue(widget.x);
            yAdjustment.setValue(widget.y);
        }
    };

    const randomizeAll = () => {
        setWidgets((prev) =>
            prev.map((w) => ({
                ...w,
                x: Math.floor(Math.random() * 300) + 25,
                y: Math.floor(Math.random() * 150) + 25,
                rotation: Math.floor(Math.random() * 360),
                scale: 0.5 + Math.random() * 1.5,
            })),
        );
    };

    const resetAll = () => {
        setWidgets((prev) =>
            prev.map((w, i) => ({
                ...w,
                x: 50 + i * 70,
                y: 100,
                rotation: 0,
                scale: 1.0,
            })),
        );
    };

    const getTransformString = (widget: TransformedWidget) => {
        return `translate(${widget.x}px, ${widget.y}px) rotate(${widget.rotation}deg) scale(${widget.scale.toFixed(2)})`;
    };

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Fixed Layout with Transforms" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GskTransform enables rotation, scaling, and positioning of widgets in a GtkFixed container. Transforms can be combined for complex effects."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Transformed Widgets">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkFixed widthRequest={400} heightRequest={250} cssClasses={[fixedContainerStyle]}>
                        {widgets.map((widget) => (
                            <x.FixedChild key={widget.id} x={widget.x} y={widget.y}>
                                <GtkButton
                                    label={widget.label}
                                    cssClasses={[
                                        cx(
                                            transformWidgetStyle,
                                            colorStyles[widget.color],
                                            selectedId === widget.id && transformSelectedStyle,
                                        ),
                                    ]}
                                    onClicked={() => handleSelect(widget.id)}
                                />
                            </x.FixedChild>
                        ))}
                    </GtkFixed>

                    <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkButton label="Randomize All" onClicked={randomizeAll} cssClasses={["suggested-action"]} />
                        <GtkButton label="Reset All" onClicked={resetAll} />
                        <GtkButton
                            label={isAnimating ? "Stop Animation" : "Animate Rotation"}
                            onClicked={() => setIsAnimating(!isAnimating)}
                            cssClasses={isAnimating ? ["destructive-action"] : []}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            {selectedWidget && (
                <GtkFrame label={`Transform Widget ${selectedWidget.label}`}>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={12}
                        marginStart={16}
                        marginEnd={16}
                        marginTop={16}
                        marginBottom={16}
                    >
                        <GtkBox spacing={12}>
                            <GtkLabel label="X Position:" widthRequest={80} halign={Gtk.Align.START} />
                            <GtkScale
                                adjustment={xAdjustment}
                                drawValue
                                digits={0}
                                valuePos={Gtk.PositionType.RIGHT}
                                hexpand
                                onValueChanged={(scale: Gtk.Range) =>
                                    updateWidget(selectedWidget.id, { x: Math.round(scale.getValue()) })
                                }
                            />
                        </GtkBox>

                        <GtkBox spacing={12}>
                            <GtkLabel label="Y Position:" widthRequest={80} halign={Gtk.Align.START} />
                            <GtkScale
                                adjustment={yAdjustment}
                                drawValue
                                digits={0}
                                valuePos={Gtk.PositionType.RIGHT}
                                hexpand
                                onValueChanged={(scale: Gtk.Range) =>
                                    updateWidget(selectedWidget.id, { y: Math.round(scale.getValue()) })
                                }
                            />
                        </GtkBox>

                        <GtkBox spacing={12}>
                            <GtkLabel label="Rotation:" widthRequest={80} halign={Gtk.Align.START} />
                            <GtkScale
                                adjustment={rotationAdjustment}
                                drawValue
                                digits={0}
                                valuePos={Gtk.PositionType.RIGHT}
                                hexpand
                                onValueChanged={(scale: Gtk.Range) =>
                                    updateWidget(selectedWidget.id, { rotation: Math.round(scale.getValue()) })
                                }
                            />
                        </GtkBox>

                        <GtkBox spacing={12}>
                            <GtkLabel label="Scale:" widthRequest={80} halign={Gtk.Align.START} />
                            <GtkScale
                                adjustment={scaleAdjustment}
                                drawValue
                                digits={2}
                                valuePos={Gtk.PositionType.RIGHT}
                                hexpand
                                onValueChanged={(scale: Gtk.Range) =>
                                    updateWidget(selectedWidget.id, { scale: scale.getValue() })
                                }
                            />
                        </GtkBox>

                        <GtkLabel
                            label={`CSS Transform: ${getTransformString(selectedWidget)}`}
                            cssClasses={["monospace", "caption", "dim-label"]}
                            halign={Gtk.Align.START}
                            wrap
                        />
                    </GtkBox>
                </GtkFrame>
            )}

            <GtkFrame label="Z-Ordering">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkLabel
                        label="In GtkFixed, z-order is determined by the order widgets are added. Later widgets appear on top."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
                        {widgets.map((w, i) => (
                            <GtkLabel
                                key={w.id}
                                label={`${w.label} (z=${i})`}
                                cssClasses={[cx(zLayerStyle, i < 2 ? zBackStyle : i < 4 ? zMiddleStyle : zFrontStyle)]}
                            />
                        ))}
                    </GtkBox>

                    <GtkLabel
                        label="Widget order: A (back) -> B -> C -> D -> E (front)"
                        cssClasses={["caption", "dim-label"]}
                        halign={Gtk.Align.CENTER}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="GskTransform API">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginStart={12}
                    marginEnd={12}
                    marginTop={12}
                    marginBottom={12}
                >
                    <GtkLabel
                        label="Available transform operations:"
                        cssClasses={["heading"]}
                        halign={Gtk.Align.START}
                    />
                    <GtkLabel
                        label={`translate(point) - Move by 2D offset
translate_3d(point3d) - Move in 3D space
rotate(angle) - Rotate around Z axis
rotate_3d(angle, axis) - Rotate around arbitrary axis
scale(x, y) - Scale in 2D
scale_3d(x, y, z) - Scale in 3D
skew(x, y) - Skew transformation
perspective(depth) - Apply perspective`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const fixed2Demo: Demo = {
    id: "fixed2",
    title: "Fixed with Transforms",
    description: "Fixed layout with GskTransform for rotation, scaling, and positioning",
    keywords: ["fixed", "transform", "rotation", "scale", "position", "GskTransform", "z-order", "3D"],
    component: Fixed2Demo,
    sourceCode,
};
