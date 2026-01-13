import { type Context, LineCap } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkDrawingArea, GtkFrame, GtkLabel, GtkScale } from "@gtkx/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./path-spinner.tsx?raw";

const createArcSpinnerDrawFunc = (rotation: number, strokeWidth: number) => {
    return (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - strokeWidth - 5;

        cr.setSourceRgba(0.5, 0.5, 0.5, 0.3)
            .setLineWidth(strokeWidth)
            .setLineCap(LineCap.ROUND)
            .arc(centerX, centerY, radius, 0, 2 * Math.PI)
            .stroke();

        cr.setSourceRgb(0.2, 0.6, 0.9);
        const startAngle = rotation;
        const endAngle = rotation + Math.PI * 0.75;
        cr.arc(centerX, centerY, radius, startAngle, endAngle).stroke();
    };
};

const createGradientSpinnerDrawFunc = (rotation: number, strokeWidth: number) => {
    return (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - strokeWidth - 5;
        const segments = 20;
        const arcLength = Math.PI * 1.2;

        cr.setLineWidth(strokeWidth).setLineCap(LineCap.ROUND);

        for (let i = 0; i < segments; i++) {
            const t = i / segments;
            const alpha = t ** 2;
            const startAngle = rotation + t * arcLength;
            const endAngle = rotation + (t + 1 / segments) * arcLength;

            cr.setSourceRgba(0.3, 0.7, 0.4, alpha).arc(centerX, centerY, radius, startAngle, endAngle).stroke();
        }
    };
};

const createDottedSpinnerDrawFunc = (rotation: number, dotSize: number) => {
    return (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - dotSize - 10;
        const dotCount = 12;

        for (let i = 0; i < dotCount; i++) {
            const angle = rotation + (i * 2 * Math.PI) / dotCount;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            const alpha = 0.2 + 0.8 * (i / dotCount);
            const size = dotSize * (0.5 + 0.5 * (i / dotCount));

            cr.setSourceRgba(0.9, 0.4, 0.3, alpha)
                .arc(x, y, size, 0, 2 * Math.PI)
                .fill();
        }
    };
};

const createPulsingSpinnerDrawFunc = (rotation: number, strokeWidth: number, pulse: number = 0) => {
    return (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
        const centerX = width / 2;
        const centerY = height / 2;
        const baseRadius = Math.min(width, height) / 2 - strokeWidth - 15;
        const pulseAmount = 8 * Math.sin(pulse);

        cr.setSourceRgba(0.6, 0.3, 0.8, 0.3 + 0.2 * Math.sin(pulse))
            .setLineWidth(strokeWidth * 0.6)
            .arc(centerX, centerY, baseRadius + pulseAmount, 0, 2 * Math.PI)
            .stroke();

        cr.setSourceRgb(0.6, 0.3, 0.8).setLineWidth(strokeWidth).setLineCap(LineCap.ROUND);
        const arcSpan = Math.PI * 0.5 + 0.3 * Math.sin(pulse * 2);
        cr.arc(centerX, centerY, baseRadius, rotation, rotation + arcSpan).stroke();

        cr.setSourceRgba(0.6, 0.3, 0.8, 0.2 + 0.15 * Math.sin(pulse + Math.PI))
            .setLineWidth(strokeWidth * 0.4)
            .arc(centerX, centerY, baseRadius - pulseAmount - 10, 0, 2 * Math.PI)
            .stroke();
    };
};

const createMultiArcSpinnerDrawFunc = (rotation: number, strokeWidth: number) => {
    return (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(width, height) / 2 - strokeWidth - 5;
        const rings = 3;

        cr.setLineWidth(strokeWidth).setLineCap(LineCap.ROUND);

        const colors: [number, number, number][] = [
            [0.2, 0.6, 0.9],
            [0.9, 0.5, 0.2],
            [0.4, 0.8, 0.4],
        ];

        for (let i = 0; i < rings; i++) {
            const radius = maxRadius - i * (strokeWidth + 8);
            const direction = i % 2 === 0 ? 1 : -1;
            const speed = 1 + i * 0.3;
            const currentRotation = rotation * speed * direction;
            const arcLength = Math.PI * (0.5 + 0.2 * i);

            const [r, g, b] = colors[i] as [number, number, number];
            cr.setSourceRgb(r, g, b)
                .arc(centerX, centerY, radius, currentRotation, currentRotation + arcLength)
                .stroke();
        }
    };
};

const AnimatedSpinner = ({
    width,
    height,
    createDrawFunc,
    label,
    strokeWidth = 6,
    speed = 1,
    withPulse = false,
}: {
    width: number;
    height: number;
    createDrawFunc: (
        rotation: number,
        strokeWidth: number,
        pulse?: number,
    ) => (self: Gtk.DrawingArea, cr: Context, w: number, h: number) => void;
    label: string;
    strokeWidth?: number;
    speed?: number;
    withPulse?: boolean;
}) => {
    const ref = useRef<Gtk.DrawingArea | null>(null);
    const rotationRef = useRef(0);
    const pulseRef = useRef(0);

    useEffect(() => {
        const interval = setInterval(() => {
            rotationRef.current += 0.08 * speed;
            if (withPulse) {
                pulseRef.current += 0.1;
            }
            if (ref.current) {
                ref.current.setDrawFunc(createDrawFunc(rotationRef.current, strokeWidth, pulseRef.current));
                ref.current.queueDraw();
            }
        }, 16);

        return () => clearInterval(interval);
    }, [createDrawFunc, strokeWidth, speed, withPulse]);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
            <GtkDrawingArea ref={ref} contentWidth={width} contentHeight={height} cssClasses={["card"]} />
            <GtkLabel label={label} cssClasses={["dim-label", "caption"]} />
        </GtkBox>
    );
};

const ConfigurableSpinner = () => {
    const ref = useRef<Gtk.DrawingArea | null>(null);
    const [strokeWidth, setStrokeWidth] = useState(8);
    const [speed, setSpeed] = useState(1);
    const [isRunning, setIsRunning] = useState(true);
    const rotationRef = useRef(0);
    const strokeAdjustment = useMemo(() => new Gtk.Adjustment(8, 2, 16, 1, 1, 0), []);
    const speedAdjustment = useMemo(() => new Gtk.Adjustment(1, 0.2, 3, 0.1, 0.5, 0), []);

    useEffect(() => {
        if (!isRunning) return;

        const interval = setInterval(() => {
            rotationRef.current += 0.08 * speed;
            if (ref.current) {
                ref.current.setDrawFunc(createArcSpinnerDrawFunc(rotationRef.current, strokeWidth));
                ref.current.queueDraw();
            }
        }, 16);

        return () => clearInterval(interval);
    }, [strokeWidth, speed, isRunning]);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkBox spacing={24} halign={Gtk.Align.CENTER}>
                <GtkDrawingArea ref={ref} contentWidth={120} contentHeight={120} cssClasses={["card"]} />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} valign={Gtk.Align.CENTER}>
                    <GtkBox spacing={8}>
                        <GtkLabel label="Stroke:" cssClasses={["dim-label"]} />
                        <GtkScale
                            drawValue
                            valuePos={Gtk.PositionType.RIGHT}
                            adjustment={strokeAdjustment}
                            onValueChanged={(range: Gtk.Range) => setStrokeWidth(range.getValue())}
                            widthRequest={120}
                        />
                    </GtkBox>
                    <GtkBox spacing={8}>
                        <GtkLabel label="Speed:" cssClasses={["dim-label"]} />
                        <GtkScale
                            drawValue
                            valuePos={Gtk.PositionType.RIGHT}
                            digits={1}
                            adjustment={speedAdjustment}
                            onValueChanged={(range: Gtk.Range) => setSpeed(range.getValue())}
                            widthRequest={120}
                        />
                    </GtkBox>
                    <GtkButton
                        label={isRunning ? "Pause" : "Resume"}
                        onClicked={() => setIsRunning(!isRunning)}
                        cssClasses={["flat"]}
                    />
                </GtkBox>
            </GtkBox>
        </GtkBox>
    );
};

const PathSpinnerDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Path-Based Spinners" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Loading spinners created with arc paths. Use animated rotation and configurable stroke widths for different visual effects."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Spinner Styles">
                <GtkBox
                    spacing={32}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    <AnimatedSpinner
                        width={80}
                        height={80}
                        createDrawFunc={createArcSpinnerDrawFunc}
                        label="Arc Spinner"
                        strokeWidth={6}
                    />
                    <AnimatedSpinner
                        width={80}
                        height={80}
                        createDrawFunc={createGradientSpinnerDrawFunc}
                        label="Gradient Tail"
                        strokeWidth={6}
                    />
                    <AnimatedSpinner
                        width={80}
                        height={80}
                        createDrawFunc={createDottedSpinnerDrawFunc}
                        label="Dotted"
                        strokeWidth={5}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Advanced Effects">
                <GtkBox
                    spacing={32}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    <AnimatedSpinner
                        width={100}
                        height={100}
                        createDrawFunc={createPulsingSpinnerDrawFunc}
                        label="Pulsing"
                        strokeWidth={5}
                        withPulse
                    />
                    <AnimatedSpinner
                        width={100}
                        height={100}
                        createDrawFunc={createMultiArcSpinnerDrawFunc}
                        label="Multi-Arc"
                        strokeWidth={5}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Configurable Spinner">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <ConfigurableSpinner />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const pathSpinnerDemo: Demo = {
    id: "path-spinner",
    title: "Path/Spinner",
    description: "Path-based loading spinners with animation",
    keywords: ["path", "spinner", "loading", "animation", "arc", "rotation", "progress", "indicator"],
    component: PathSpinnerDemo,
    sourceCode,
};
