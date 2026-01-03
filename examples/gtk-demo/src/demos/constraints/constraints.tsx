import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel } from "@gtkx/react";
import { useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./constraints.tsx?raw";

/**
 * Demo showing basic centering using constraints.
 * The button is centered both horizontally and vertically in the container.
 */
const CenteringDemo = () => {
    const containerRef = useRef<Gtk.Box | null>(null);
    const buttonRef = useRef<Gtk.Button | null>(null);
    const layoutRef = useRef<Gtk.ConstraintLayout | null>(null);

    useEffect(() => {
        if (!containerRef.current || !buttonRef.current) return;

        const layout = new Gtk.ConstraintLayout();
        layoutRef.current = layout;
        containerRef.current.setLayoutManager(layout);

        const centerX = new Gtk.Constraint(
            buttonRef.current,
            Gtk.ConstraintAttribute.CENTER_X,
            Gtk.ConstraintRelation.EQ,
            undefined,
            Gtk.ConstraintAttribute.CENTER_X,
            1.0,
            0,
            Gtk.ConstraintStrength.REQUIRED,
        );

        const centerY = new Gtk.Constraint(
            buttonRef.current,
            Gtk.ConstraintAttribute.CENTER_Y,
            Gtk.ConstraintRelation.EQ,
            undefined,
            Gtk.ConstraintAttribute.CENTER_Y,
            1.0,
            0,
            Gtk.ConstraintStrength.REQUIRED,
        );

        layout.addConstraint(centerX);
        layout.addConstraint(centerY);
    }, []);

    return (
        <GtkFrame label="Centering">
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={8}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
            >
                <GtkLabel
                    label="Button centered using centerX and centerY constraints."
                    cssClasses={["dim-label"]}
                    wrap
                    halign={Gtk.Align.START}
                />
                <GtkBox
                    ref={containerRef}
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={0}
                    widthRequest={300}
                    heightRequest={100}
                    cssClasses={["card"]}
                >
                    <GtkButton ref={buttonRef} label="Centered" />
                </GtkBox>
            </GtkBox>
        </GtkFrame>
    );
};

/**
 * Demo showing edge alignment using constraints.
 * Buttons are aligned to the corners and edges of the container.
 */
const AlignmentDemo = () => {
    const containerRef = useRef<Gtk.Box | null>(null);
    const topLeftRef = useRef<Gtk.Button | null>(null);
    const topRightRef = useRef<Gtk.Button | null>(null);
    const bottomLeftRef = useRef<Gtk.Button | null>(null);
    const bottomRightRef = useRef<Gtk.Button | null>(null);
    const layoutRef = useRef<Gtk.ConstraintLayout | null>(null);

    useEffect(() => {
        if (
            !containerRef.current ||
            !topLeftRef.current ||
            !topRightRef.current ||
            !bottomLeftRef.current ||
            !bottomRightRef.current
        )
            return;

        const layout = new Gtk.ConstraintLayout();
        layoutRef.current = layout;
        containerRef.current.setLayoutManager(layout);
        const MARGIN = 8;

        layout.addConstraint(
            new Gtk.Constraint(
                topLeftRef.current,
                Gtk.ConstraintAttribute.START,
                Gtk.ConstraintRelation.EQ,
                undefined,
                Gtk.ConstraintAttribute.START,
                1.0,
                MARGIN,
                Gtk.ConstraintStrength.REQUIRED,
            ),
        );
        layout.addConstraint(
            new Gtk.Constraint(
                topLeftRef.current,
                Gtk.ConstraintAttribute.TOP,
                Gtk.ConstraintRelation.EQ,
                undefined,
                Gtk.ConstraintAttribute.TOP,
                1.0,
                MARGIN,
                Gtk.ConstraintStrength.REQUIRED,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                topRightRef.current,
                Gtk.ConstraintAttribute.END,
                Gtk.ConstraintRelation.EQ,
                undefined,
                Gtk.ConstraintAttribute.END,
                1.0,
                -MARGIN,
                Gtk.ConstraintStrength.REQUIRED,
            ),
        );
        layout.addConstraint(
            new Gtk.Constraint(
                topRightRef.current,
                Gtk.ConstraintAttribute.TOP,
                Gtk.ConstraintRelation.EQ,
                undefined,
                Gtk.ConstraintAttribute.TOP,
                1.0,
                MARGIN,
                Gtk.ConstraintStrength.REQUIRED,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                bottomLeftRef.current,
                Gtk.ConstraintAttribute.START,
                Gtk.ConstraintRelation.EQ,
                undefined,
                Gtk.ConstraintAttribute.START,
                1.0,
                MARGIN,
                Gtk.ConstraintStrength.REQUIRED,
            ),
        );
        layout.addConstraint(
            new Gtk.Constraint(
                bottomLeftRef.current,
                Gtk.ConstraintAttribute.BOTTOM,
                Gtk.ConstraintRelation.EQ,
                undefined,
                Gtk.ConstraintAttribute.BOTTOM,
                1.0,
                -MARGIN,
                Gtk.ConstraintStrength.REQUIRED,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                bottomRightRef.current,
                Gtk.ConstraintAttribute.END,
                Gtk.ConstraintRelation.EQ,
                undefined,
                Gtk.ConstraintAttribute.END,
                1.0,
                -MARGIN,
                Gtk.ConstraintStrength.REQUIRED,
            ),
        );
        layout.addConstraint(
            new Gtk.Constraint(
                bottomRightRef.current,
                Gtk.ConstraintAttribute.BOTTOM,
                Gtk.ConstraintRelation.EQ,
                undefined,
                Gtk.ConstraintAttribute.BOTTOM,
                1.0,
                -MARGIN,
                Gtk.ConstraintStrength.REQUIRED,
            ),
        );
    }, []);

    return (
        <GtkFrame label="Edge Alignment">
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={8}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
            >
                <GtkLabel
                    label="Buttons positioned at corners using START/END and TOP/BOTTOM constraints."
                    cssClasses={["dim-label"]}
                    wrap
                    halign={Gtk.Align.START}
                />
                <GtkBox
                    ref={containerRef}
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={0}
                    widthRequest={350}
                    heightRequest={120}
                    cssClasses={["card"]}
                >
                    <GtkButton ref={topLeftRef} label="Top Left" />
                    <GtkButton ref={topRightRef} label="Top Right" />
                    <GtkButton ref={bottomLeftRef} label="Bottom Left" />
                    <GtkButton ref={bottomRightRef} label="Bottom Right" />
                </GtkBox>
            </GtkBox>
        </GtkFrame>
    );
};

/**
 * Demo showing spacing constraints between widgets.
 */
const SpacingDemo = () => {
    const containerRef = useRef<Gtk.Box | null>(null);
    const button1Ref = useRef<Gtk.Button | null>(null);
    const button2Ref = useRef<Gtk.Button | null>(null);
    const button3Ref = useRef<Gtk.Button | null>(null);
    const layoutRef = useRef<Gtk.ConstraintLayout | null>(null);

    useEffect(() => {
        if (!containerRef.current || !button1Ref.current || !button2Ref.current || !button3Ref.current) return;

        const layout = new Gtk.ConstraintLayout();
        layoutRef.current = layout;
        containerRef.current.setLayoutManager(layout);
        const SPACING = 12;

        for (const buttonRef of [button1Ref, button2Ref, button3Ref]) {
            const button = buttonRef.current;
            if (!button) continue;
            layout.addConstraint(
                new Gtk.Constraint(
                    button,
                    Gtk.ConstraintAttribute.CENTER_Y,
                    Gtk.ConstraintRelation.EQ,
                    undefined,
                    Gtk.ConstraintAttribute.CENTER_Y,
                    1.0,
                    0,
                    Gtk.ConstraintStrength.REQUIRED,
                ),
            );
        }

        layout.addConstraint(
            new Gtk.Constraint(
                button1Ref.current,
                Gtk.ConstraintAttribute.START,
                Gtk.ConstraintRelation.EQ,
                undefined,
                Gtk.ConstraintAttribute.START,
                1.0,
                SPACING,
                Gtk.ConstraintStrength.REQUIRED,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                button2Ref.current,
                Gtk.ConstraintAttribute.START,
                Gtk.ConstraintRelation.EQ,
                button1Ref.current,
                Gtk.ConstraintAttribute.END,
                1.0,
                SPACING,
                Gtk.ConstraintStrength.REQUIRED,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                button3Ref.current,
                Gtk.ConstraintAttribute.START,
                Gtk.ConstraintRelation.EQ,
                button2Ref.current,
                Gtk.ConstraintAttribute.END,
                1.0,
                SPACING,
                Gtk.ConstraintStrength.REQUIRED,
            ),
        );
    }, []);

    return (
        <GtkFrame label="Spacing Between Widgets">
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={8}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
            >
                <GtkLabel
                    label="Buttons are chained together with spacing constraints between them."
                    cssClasses={["dim-label"]}
                    wrap
                    halign={Gtk.Align.START}
                />
                <GtkBox
                    ref={containerRef}
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={0}
                    widthRequest={400}
                    heightRequest={80}
                    cssClasses={["card"]}
                >
                    <GtkButton ref={button1Ref} label="First" />
                    <GtkButton ref={button2Ref} label="Second" />
                    <GtkButton ref={button3Ref} label="Third" />
                </GtkBox>
            </GtkBox>
        </GtkFrame>
    );
};

/**
 * Demo showing size constraints with constant values.
 */
const SizeConstraintsDemo = () => {
    const containerRef = useRef<Gtk.Box | null>(null);
    const buttonRef = useRef<Gtk.Button | null>(null);
    const layoutRef = useRef<Gtk.ConstraintLayout | null>(null);
    const [minWidth, setMinWidth] = useState(150);

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
                buttonRef.current,
                Gtk.ConstraintAttribute.CENTER_X,
                Gtk.ConstraintRelation.EQ,
                undefined,
                Gtk.ConstraintAttribute.CENTER_X,
                1.0,
                0,
                Gtk.ConstraintStrength.REQUIRED,
            ),
        );
        layout.addConstraint(
            new Gtk.Constraint(
                buttonRef.current,
                Gtk.ConstraintAttribute.CENTER_Y,
                Gtk.ConstraintRelation.EQ,
                undefined,
                Gtk.ConstraintAttribute.CENTER_Y,
                1.0,
                0,
                Gtk.ConstraintStrength.REQUIRED,
            ),
        );

        const widthConstraint = Gtk.Constraint.newConstant(
            buttonRef.current,
            Gtk.ConstraintAttribute.WIDTH,
            Gtk.ConstraintRelation.GE,
            minWidth,
            Gtk.ConstraintStrength.REQUIRED,
        );
        layout.addConstraint(widthConstraint);

        const heightConstraint = Gtk.Constraint.newConstant(
            buttonRef.current,
            Gtk.ConstraintAttribute.HEIGHT,
            Gtk.ConstraintRelation.EQ,
            50,
            Gtk.ConstraintStrength.STRONG,
        );
        layout.addConstraint(heightConstraint);
    }, [minWidth]);

    return (
        <GtkFrame label="Size Constraints">
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={8}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
            >
                <GtkLabel
                    label="Button has minimum width and fixed height constraints."
                    cssClasses={["dim-label"]}
                    wrap
                    halign={Gtk.Align.START}
                />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
                    <GtkButton label="Smaller Min Width" onClicked={() => setMinWidth(Math.max(100, minWidth - 25))} />
                    <GtkButton label="Larger Min Width" onClicked={() => setMinWidth(Math.min(300, minWidth + 25))} />
                    <GtkLabel label={`Min Width: ${minWidth}px`} cssClasses={["dim-label"]} />
                </GtkBox>
                <GtkBox
                    ref={containerRef}
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={0}
                    widthRequest={400}
                    heightRequest={100}
                    cssClasses={["card"]}
                >
                    <GtkButton ref={buttonRef} label="Constrained Size" cssClasses={["suggested-action"]} />
                </GtkBox>
            </GtkBox>
        </GtkFrame>
    );
};

const ConstraintsDemo = () => {
    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Constraint Layout" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GtkConstraintLayout uses a constraint-based approach to position widgets. Constraints describe relationships between widget attributes like position, size, and alignment. This is similar to Auto Layout on iOS/macOS."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <CenteringDemo />
            <AlignmentDemo />
            <SpacingDemo />
            <SizeConstraintsDemo />

            <GtkFrame label="Constraint Attributes">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Available constraint attributes:"
                        cssClasses={["heading"]}
                        halign={Gtk.Align.START}
                    />
                    <GtkLabel
                        label={`Position: LEFT, RIGHT, TOP, BOTTOM, START, END
Size: WIDTH, HEIGHT
Center: CENTER_X, CENTER_Y
Text: BASELINE`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const constraintsDemo: Demo = {
    id: "constraints",
    title: "Constraints",
    description: "Introduction to constraint-based layout using GtkConstraintLayout.",
    keywords: ["constraint", "layout", "GtkConstraintLayout", "GtkConstraint", "positioning", "alignment", "centering"],
    component: ConstraintsDemo,
    sourceCode,
};
