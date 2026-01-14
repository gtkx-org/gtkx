import { CallbackAnimationTarget, Easing, TimedAnimation } from "@gtkx/ffi/adw";
import { type Context, FontSlant, FontWeight, LineCap } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkDrawingArea, GtkFrame, GtkLabel } from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./path-sweep.tsx?raw";

const easingMap: Record<string, Easing> = {
    linear: Easing.LINEAR,
    easeInQuad: Easing.EASE_IN_QUAD,
    easeOutQuad: Easing.EASE_OUT_QUAD,
    easeInOutQuad: Easing.EASE_IN_OUT_QUAD,
    easeInCubic: Easing.EASE_IN_CUBIC,
    easeOutCubic: Easing.EASE_OUT_CUBIC,
    easeInOutCubic: Easing.EASE_IN_OUT_CUBIC,
    easeOutElastic: Easing.EASE_OUT_ELASTIC,
    easeOutBounce: Easing.EASE_OUT_BOUNCE,
};

type EasingName = keyof typeof easingMap;

const easingNames = Object.keys(easingMap) as EasingName[];

const easingFunctions = {
    linear: (t: number) => t,
    easeInQuad: (t: number) => t * t,
    easeOutQuad: (t: number) => t * (2 - t),
    easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    easeInCubic: (t: number) => t * t * t,
    easeOutCubic: (t: number) => (t - 1) ** 3 + 1,
    easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t ** 3 : (t - 1) * (2 * t - 2) ** 2 + 1),
    easeOutElastic: (t: number) => {
        const p = 0.3;
        return 2 ** (-10 * t) * Math.sin(((t - p / 4) * (2 * Math.PI)) / p) + 1;
    },
    easeOutBounce: (t: number) => {
        if (t < 1 / 2.75) {
            return 7.5625 * t * t;
        } else if (t < 2 / 2.75) {
            const t2 = t - 1.5 / 2.75;
            return 7.5625 * t2 * t2 + 0.75;
        } else if (t < 2.5 / 2.75) {
            const t2 = t - 2.25 / 2.75;
            return 7.5625 * t2 * t2 + 0.9375;
        } else {
            const t2 = t - 2.625 / 2.75;
            return 7.5625 * t2 * t2 + 0.984375;
        }
    },
};

const createDashSweepDrawFunc = (progress: number, dashLength: number = 20) => {
    return (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
        const padding = 30;
        const w = width - padding * 2;
        const h = height - padding * 2;

        cr.setSourceRgba(0.5, 0.5, 0.5, 0.3)
            .setLineWidth(4)
            .setLineCap(LineCap.ROUND)
            .moveTo(padding, padding + h / 2)
            .curveTo(padding + w * 0.25, padding, padding + w * 0.25, padding + h, padding + w * 0.5, padding + h / 2)
            .curveTo(padding + w * 0.75, padding, padding + w * 0.75, padding + h, padding + w, padding + h / 2)
            .stroke();

        const pathLength = w * 2;

        cr.setSourceRgb(0.2, 0.6, 0.9).setLineWidth(6);

        const dashOffset = -progress * pathLength;
        cr.setDash([dashLength, pathLength - dashLength], dashOffset)
            .moveTo(padding, padding + h / 2)
            .curveTo(padding + w * 0.25, padding, padding + w * 0.25, padding + h, padding + w * 0.5, padding + h / 2)
            .curveTo(padding + w * 0.75, padding, padding + w * 0.75, padding + h, padding + w, padding + h / 2)
            .stroke();

        cr.setDash([], 0);
    };
};

const createPathRevealDrawFunc = (progress: number) => {
    return (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
        const padding = 30;
        const w = width - padding * 2;
        const h = height - padding * 2;
        const pathLength = w * 2.5;

        cr.setSourceRgba(0.5, 0.5, 0.5, 0.2).setLineWidth(3).setLineCap(LineCap.ROUND);

        const centerX = width / 2;
        const centerY = height / 2;
        const outerRadius = Math.min(w, h) / 2 - 10;
        const innerRadius = outerRadius * 0.4;
        const points = 5;

        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            if (i === 0) {
                cr.moveTo(x, y);
            } else {
                cr.lineTo(x, y);
            }
        }
        cr.closePath().stroke();

        cr.setSourceRgb(0.9, 0.4, 0.3).setLineWidth(5);

        const visibleLength = progress * pathLength * 1.2;
        cr.setDash([visibleLength, pathLength * 2], 0);

        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            if (i === 0) {
                cr.moveTo(x, y);
            } else {
                cr.lineTo(x, y);
            }
        }
        cr.closePath().stroke();

        cr.setDash([], 0);
    };
};

const createMultiDashSweepDrawFunc = (progress: number) => {
    return (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
        const padding = 30;
        const w = width - padding * 2;
        const h = height - padding * 2;

        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(w, h) / 2;
        const spiralTurns = 3;
        const numPoints = 100;

        cr.setSourceRgba(0.5, 0.5, 0.5, 0.2).setLineWidth(2);

        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const angle = t * spiralTurns * 2 * Math.PI;
            const radius = t * maxRadius;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            if (i === 0) {
                cr.moveTo(x, y);
            } else {
                cr.lineTo(x, y);
            }
        }
        cr.stroke();

        const pathLength = spiralTurns * Math.PI * maxRadius;
        const dashLength = pathLength / 8;
        const gapLength = dashLength;
        const dashOffset = -progress * pathLength * 2;

        cr.setSourceRgb(0.4, 0.8, 0.5)
            .setLineWidth(4)
            .setLineCap(LineCap.ROUND)
            .setDash([dashLength, gapLength], dashOffset);

        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const angle = t * spiralTurns * 2 * Math.PI;
            const radius = t * maxRadius;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            if (i === 0) {
                cr.moveTo(x, y);
            } else {
                cr.lineTo(x, y);
            }
        }
        cr.stroke();

        cr.setDash([], 0);
    };
};

const ANIMATION_DURATION_MS = 1600;

const AnimatedSweep = ({
    width,
    height,
    createDrawFunc,
    label,
    speed = 1,
    easing = "linear" as EasingName,
}: {
    width: number;
    height: number;
    createDrawFunc: (
        progress: number,
        extra?: number,
    ) => (self: Gtk.DrawingArea, cr: Context, w: number, h: number) => void;
    label: string;
    speed?: number;
    easing?: EasingName;
}) => {
    const areaRef = useRef<Gtk.DrawingArea | null>(null);
    const progressRef = useRef(0);
    const forwardRef = useRef(true);

    const drawFunc = useCallback(
        (self: Gtk.DrawingArea, cr: Context, w: number, h: number) => {
            createDrawFunc(progressRef.current, 80)(self, cr, w, h);
        },
        [createDrawFunc],
    );

    useEffect(() => {
        const area = areaRef.current;
        if (!area) return;

        const runAnimation = () => {
            const target = new CallbackAnimationTarget((value: number) => {
                progressRef.current = forwardRef.current ? value : 1 - value;
                area.queueDraw();
            });

            const animation = new TimedAnimation(area, 0, 1, Math.round(ANIMATION_DURATION_MS / speed), target);
            animation.setEasing(easingMap[easing] ?? Easing.LINEAR);

            animation.connect("done", () => {
                forwardRef.current = !forwardRef.current;
                runAnimation();
            });

            animation.play();

            return animation;
        };

        const animation = runAnimation();

        return () => {
            animation.reset();
        };
    }, [speed, easing]);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
            <GtkDrawingArea
                ref={areaRef}
                onDraw={drawFunc}
                contentWidth={width}
                contentHeight={height}
                cssClasses={["card"]}
            />
            <GtkLabel label={label} cssClasses={["dim-label", "caption"]} />
        </GtkBox>
    );
};

const EasingVisualizer = () => {
    const areaRef = useRef<Gtk.DrawingArea | null>(null);
    const [selectedEasing, setSelectedEasing] = useState<EasingName>("easeOutQuad");
    const progressRef = useRef(0);

    const drawEasing = useCallback(
        (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
            const progress = progressRef.current;
            const padding = 30;
            const w = width - padding * 2;
            const h = height - padding * 2;

            cr.setSourceRgba(0.5, 0.5, 0.5, 0.5)
                .setLineWidth(1)
                .moveTo(padding, padding)
                .lineTo(padding, padding + h)
                .lineTo(padding + w, padding + h)
                .stroke();

            cr.setSourceRgba(0.5, 0.5, 0.5, 0.3).setLineWidth(2);
            const easingFn = easingFunctions[selectedEasing as keyof typeof easingFunctions];

            for (let i = 0; i <= 100; i++) {
                const t = i / 100;
                const x = padding + t * w;
                const y = padding + h - easingFn(t) * h;
                if (i === 0) {
                    cr.moveTo(x, y);
                } else {
                    cr.lineTo(x, y);
                }
            }
            cr.stroke();

            const x = padding + progress * w;
            const y = padding + h - easingFn(progress) * h;

            cr.setSourceRgba(0.2, 0.6, 0.9, 0.5)
                .setLineWidth(1)
                .moveTo(x, padding + h)
                .lineTo(x, y)
                .stroke();

            cr.moveTo(padding, y).lineTo(x, y).stroke();

            cr.setSourceRgb(0.9, 0.3, 0.3)
                .arc(x, y, 6, 0, 2 * Math.PI)
                .fill();

            cr.selectFontFace("Sans", FontSlant.NORMAL, FontWeight.NORMAL)
                .setFontSize(10)
                .setSourceRgb(0.5, 0.5, 0.5)
                .moveTo(padding - 5, padding + h + 15)
                .showText("0");
            cr.moveTo(padding + w - 5, padding + h + 15).showText("1");
            cr.moveTo(padding - 20, padding + h).showText("0");
            cr.moveTo(padding - 20, padding + 5).showText("1");
        },
        [selectedEasing],
    );

    useEffect(() => {
        const area = areaRef.current;
        if (!area) return;

        const target = new CallbackAnimationTarget((value: number) => {
            progressRef.current = value;
            area.queueDraw();
        });

        const animation = new TimedAnimation(area, 0, 1, 2000, target);
        animation.setRepeatCount(0);
        animation.play();

        return () => {
            animation.reset();
        };
    }, []);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkDrawingArea
                ref={areaRef}
                onDraw={drawEasing}
                contentWidth={300}
                contentHeight={200}
                cssClasses={["card"]}
                halign={Gtk.Align.CENTER}
            />
            <GtkBox spacing={4} halign={Gtk.Align.CENTER} homogeneous>
                {easingNames.slice(0, 5).map((name) => (
                    <GtkButton
                        key={name}
                        label={name.replace("ease", "")}
                        onClicked={() => setSelectedEasing(name)}
                        cssClasses={selectedEasing === name ? ["suggested-action"] : ["flat"]}
                    />
                ))}
            </GtkBox>
            <GtkBox spacing={4} halign={Gtk.Align.CENTER} homogeneous>
                {easingNames.slice(5).map((name) => (
                    <GtkButton
                        key={name}
                        label={name.replace("ease", "")}
                        onClicked={() => setSelectedEasing(name)}
                        cssClasses={selectedEasing === name ? ["suggested-action"] : ["flat"]}
                    />
                ))}
            </GtkBox>
        </GtkBox>
    );
};

const PathSweepDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Path Sweep Animations" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Animate dash offset along paths using GTK's native TimedAnimation API with built-in easing functions. Animations respect system accessibility settings."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Sweep Effects">
                <GtkBox
                    spacing={24}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    <AnimatedSweep
                        width={200}
                        height={150}
                        createDrawFunc={createDashSweepDrawFunc}
                        label="Dash Sweep"
                        easing="easeInOutQuad"
                    />
                    <AnimatedSweep
                        width={180}
                        height={180}
                        createDrawFunc={createPathRevealDrawFunc}
                        label="Path Reveal"
                        easing="easeOutCubic"
                    />
                    <AnimatedSweep
                        width={180}
                        height={180}
                        createDrawFunc={createMultiDashSweepDrawFunc}
                        label="Multi-Dash Spiral"
                        speed={0.5}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Easing Functions">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <EasingVisualizer />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const pathSweepDemo: Demo = {
    id: "path-sweep",
    title: "Path/Sweep",
    description: "Animate dash offset for sweep and reveal effects with GTK easing",
    keywords: ["path", "sweep", "dash", "animation", "reveal", "easing", "offset", "stroke", "TimedAnimation"],
    component: PathSweepDemo,
    sourceCode,
};
