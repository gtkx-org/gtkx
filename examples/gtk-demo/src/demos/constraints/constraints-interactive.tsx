import { type Context, FontSlant, FontWeight } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkDrawingArea, GtkFrame, GtkLabel, GtkScale } from "@gtkx/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./constraints-interactive.tsx?raw";

interface WidgetPosition {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ConstraintDef {
    id: string;
    label: string;
    targetAttr: Gtk.ConstraintAttribute;
    sourceAttr: Gtk.ConstraintAttribute;
    constant: number;
}

/**
 * Interactive constraint visualization using GtkDrawingArea.
 * Shows widgets as rectangles and constraint lines connecting them.
 */
const ConstraintVisualizer = ({
    containerWidth,
    containerHeight,
    widgets,
    constraints,
}: {
    containerWidth: number;
    containerHeight: number;
    widgets: Map<string, WidgetPosition>;
    constraints: ConstraintDef[];
}) => {
    const drawingRef = useRef<Gtk.DrawingArea | null>(null);

    const draw = useCallback(
        (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
            cr.setSourceRgb(0.15, 0.15, 0.18).rectangle(0, 0, width, height).fill();

            cr.setSourceRgba(1, 1, 1, 0.1).setLineWidth(1);
            const gridSize = 20;
            for (let x = 0; x <= width; x += gridSize) {
                cr.moveTo(x, 0).lineTo(x, height);
            }
            for (let y = 0; y <= height; y += gridSize) {
                cr.moveTo(0, y).lineTo(width, y);
            }
            cr.stroke();

            cr.setLineWidth(2);
            for (const constraint of constraints) {
                const targetWidget = widgets.get("button");
                if (!targetWidget) continue;

                let startX = 0;
                let startY = 0;
                let endX = 0;
                let endY = 0;

                const w = targetWidget;

                switch (constraint.targetAttr) {
                    case Gtk.ConstraintAttribute.CENTER_X:
                        startX = w.x + w.width / 2;
                        startY = w.y + w.height / 2;
                        break;
                    case Gtk.ConstraintAttribute.CENTER_Y:
                        startX = w.x + w.width / 2;
                        startY = w.y + w.height / 2;
                        break;
                    case Gtk.ConstraintAttribute.START:
                    case Gtk.ConstraintAttribute.LEFT:
                        startX = w.x;
                        startY = w.y + w.height / 2;
                        break;
                    case Gtk.ConstraintAttribute.END:
                    case Gtk.ConstraintAttribute.RIGHT:
                        startX = w.x + w.width;
                        startY = w.y + w.height / 2;
                        break;
                    case Gtk.ConstraintAttribute.TOP:
                        startX = w.x + w.width / 2;
                        startY = w.y;
                        break;
                    case Gtk.ConstraintAttribute.BOTTOM:
                        startX = w.x + w.width / 2;
                        startY = w.y + w.height;
                        break;
                }

                switch (constraint.sourceAttr) {
                    case Gtk.ConstraintAttribute.CENTER_X:
                        endX = width / 2;
                        endY = startY;
                        break;
                    case Gtk.ConstraintAttribute.CENTER_Y:
                        endX = startX;
                        endY = height / 2;
                        break;
                    case Gtk.ConstraintAttribute.START:
                    case Gtk.ConstraintAttribute.LEFT:
                        endX = 0;
                        endY = startY;
                        break;
                    case Gtk.ConstraintAttribute.END:
                    case Gtk.ConstraintAttribute.RIGHT:
                        endX = width;
                        endY = startY;
                        break;
                    case Gtk.ConstraintAttribute.TOP:
                        endX = startX;
                        endY = 0;
                        break;
                    case Gtk.ConstraintAttribute.BOTTOM:
                        endX = startX;
                        endY = height;
                        break;
                }

                cr.setSourceRgba(0.3, 0.7, 1, 0.8)
                    .setDash([6, 4], 0)
                    .moveTo(startX, startY)
                    .lineTo(endX, endY)
                    .stroke()
                    .setDash([], 0);

                cr.setSourceRgb(0.3, 0.7, 1)
                    .arc(startX, startY, 4, 0, 2 * Math.PI)
                    .fill()
                    .arc(endX, endY, 4, 0, 2 * Math.PI)
                    .fill();
            }

            for (const [name, pos] of widgets) {
                cr.setSourceRgb(0.2, 0.5, 0.8).rectangle(pos.x, pos.y, pos.width, pos.height).fill();

                cr.setSourceRgb(0.3, 0.6, 0.9).setLineWidth(2).rectangle(pos.x, pos.y, pos.width, pos.height).stroke();

                cr.setSourceRgb(1, 1, 1)
                    .selectFontFace("Sans", FontSlant.NORMAL, FontWeight.BOLD)
                    .setFontSize(12)
                    .moveTo(pos.x + 8, pos.y + pos.height / 2 + 4)
                    .showText(name);
            }

            cr.setSourceRgba(0.5, 0.5, 0.5, 0.5)
                .setLineWidth(1)
                .rectangle(0.5, 0.5, width - 1, height - 1)
                .stroke();
        },
        [widgets, constraints],
    );

    useEffect(() => {
        if (drawingRef.current) {
            drawingRef.current.setDrawFunc(draw);
        }
    }, [draw]);

    return (
        <GtkDrawingArea
            ref={drawingRef}
            contentWidth={containerWidth}
            contentHeight={containerHeight}
            cssClasses={["card"]}
        />
    );
};

/**
 * Interactive constraint editor with sliders.
 */
const InteractiveConstraintEditor = () => {
    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);
    const [widgetWidth, setWidgetWidth] = useState(100);
    const [widgetHeight, setWidgetHeight] = useState(40);

    const containerWidth = 400;
    const containerHeight = 250;

    const widgetX = containerWidth / 2 - widgetWidth / 2 + offsetX;
    const widgetY = containerHeight / 2 - widgetHeight / 2 + offsetY;

    const widgets = new Map<string, WidgetPosition>([
        ["button", { x: widgetX, y: widgetY, width: widgetWidth, height: widgetHeight }],
    ]);

    const constraints: ConstraintDef[] = [
        {
            id: "centerX",
            label: "Center X",
            targetAttr: Gtk.ConstraintAttribute.CENTER_X,
            sourceAttr: Gtk.ConstraintAttribute.CENTER_X,
            constant: offsetX,
        },
        {
            id: "centerY",
            label: "Center Y",
            targetAttr: Gtk.ConstraintAttribute.CENTER_Y,
            sourceAttr: Gtk.ConstraintAttribute.CENTER_Y,
            constant: offsetY,
        },
    ];

    const xAdjustment = useMemo(() => new Gtk.Adjustment(0, -150, 150, 1, 10, 0), []);
    const yAdjustment = useMemo(() => new Gtk.Adjustment(0, -100, 100, 1, 10, 0), []);
    const widthAdjustment = useMemo(() => new Gtk.Adjustment(100, 50, 200, 1, 10, 0), []);
    const heightAdjustment = useMemo(() => new Gtk.Adjustment(40, 30, 100, 1, 10, 0), []);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={16}>
            <ConstraintVisualizer
                containerWidth={containerWidth}
                containerHeight={containerHeight}
                widgets={widgets}
                constraints={constraints}
            />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkBox spacing={12}>
                    <GtkLabel label="X Offset:" halign={Gtk.Align.START} widthRequest={100} />
                    <GtkScale
                        hexpand
                        drawValue
                        valuePos={Gtk.PositionType.RIGHT}
                        adjustment={xAdjustment}
                        onValueChanged={(scale) => setOffsetX(scale.getValue())}
                    />
                </GtkBox>

                <GtkBox spacing={12}>
                    <GtkLabel label="Y Offset:" halign={Gtk.Align.START} widthRequest={100} />
                    <GtkScale
                        hexpand
                        drawValue
                        valuePos={Gtk.PositionType.RIGHT}
                        adjustment={yAdjustment}
                        onValueChanged={(scale) => setOffsetY(scale.getValue())}
                    />
                </GtkBox>

                <GtkBox spacing={12}>
                    <GtkLabel label="Width:" halign={Gtk.Align.START} widthRequest={100} />
                    <GtkScale
                        hexpand
                        drawValue
                        valuePos={Gtk.PositionType.RIGHT}
                        adjustment={widthAdjustment}
                        onValueChanged={(scale) => setWidgetWidth(scale.getValue())}
                    />
                </GtkBox>

                <GtkBox spacing={12}>
                    <GtkLabel label="Height:" halign={Gtk.Align.START} widthRequest={100} />
                    <GtkScale
                        hexpand
                        drawValue
                        valuePos={Gtk.PositionType.RIGHT}
                        adjustment={heightAdjustment}
                        onValueChanged={(scale) => setWidgetHeight(scale.getValue())}
                    />
                </GtkBox>
            </GtkBox>

            <GtkFrame label="Active Constraints">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={4}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label={`button.centerX = parent.centerX + ${offsetX}`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                    <GtkLabel
                        label={`button.centerY = parent.centerY + ${offsetY}`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                    <GtkLabel
                        label={`button.width = ${widgetWidth} (constant)`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                    <GtkLabel
                        label={`button.height = ${widgetHeight} (constant)`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

/**
 * Live constraint layout demo that updates in real-time.
 */
const LiveConstraintDemo = () => {
    const containerRef = useRef<Gtk.Box | null>(null);
    const buttonRef = useRef<Gtk.Button | null>(null);
    const layoutRef = useRef<Gtk.ConstraintLayout | null>(null);
    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);

    useEffect(() => {
        if (!containerRef.current || !buttonRef.current) return;

        if (!layoutRef.current) {
            layoutRef.current = new Gtk.ConstraintLayout();
            containerRef.current.setLayoutManager(layoutRef.current);
        }

        const layout = layoutRef.current;

        layout.removeAllConstraints();

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.CENTER_X,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.CENTER_X,
                1.0,
                offsetX,
                Gtk.ConstraintStrength.REQUIRED,
                buttonRef.current,
                undefined,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.CENTER_Y,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.CENTER_Y,
                1.0,
                offsetY,
                Gtk.ConstraintStrength.REQUIRED,
                buttonRef.current,
                undefined,
            ),
        );
    }, [offsetX, offsetY]);

    return (
        <GtkFrame label="Live Constraint Updates">
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={12}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
            >
                <GtkLabel
                    label="Move the button by changing the constraint constants in real-time."
                    cssClasses={["dim-label"]}
                    wrap
                    halign={Gtk.Align.START}
                />

                <GtkBox ref={containerRef} widthRequest={350} heightRequest={150} cssClasses={["card"]}>
                    <GtkButton ref={buttonRef} label="Drag Me!" cssClasses={["suggested-action"]} />
                </GtkBox>

                <GtkBox spacing={8}>
                    <GtkButton label="Left" onClicked={() => setOffsetX(offsetX - 20)} />
                    <GtkButton label="Right" onClicked={() => setOffsetX(offsetX + 20)} />
                    <GtkButton label="Up" onClicked={() => setOffsetY(offsetY - 20)} />
                    <GtkButton label="Down" onClicked={() => setOffsetY(offsetY + 20)} />
                    <GtkButton
                        label="Reset"
                        onClicked={() => {
                            setOffsetX(0);
                            setOffsetY(0);
                        }}
                        cssClasses={["destructive-action"]}
                    />
                </GtkBox>

                <GtkLabel label={`Offset: (${offsetX}, ${offsetY})`} cssClasses={["dim-label", "monospace"]} />
            </GtkBox>
        </GtkFrame>
    );
};

const ConstraintsInteractiveDemo = () => {
    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Interactive Constraints" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="This demo shows how constraints can be visualized and modified interactively. Use the sliders to adjust constraint constants and see the results in real-time."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Constraint Visualization">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="The visualization shows constraint lines connecting widget attributes to their sources. Blue dashed lines represent active constraints."
                        cssClasses={["dim-label"]}
                        wrap
                        halign={Gtk.Align.START}
                    />
                    <InteractiveConstraintEditor />
                </GtkBox>
            </GtkFrame>

            <LiveConstraintDemo />
        </GtkBox>
    );
};

export const constraintsInteractiveDemo: Demo = {
    id: "constraints-interactive",
    title: "Constraints/Interactive Constraints",
    description: "This example shows how constraints can be updated during user interaction.",
    keywords: ["constraint", "interactive", "editor", "visual", "drag", "real-time", "GtkConstraintLayout"],
    component: ConstraintsInteractiveDemo,
    sourceCode,
};
