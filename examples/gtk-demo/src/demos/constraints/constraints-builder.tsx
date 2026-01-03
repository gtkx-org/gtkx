import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel } from "@gtkx/react";
import { useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./constraints-builder.tsx?raw";

/**
 * Helper function to create constraint with readable parameters.
 */
const createConstraint = (options: {
    target: Gtk.ConstraintTarget | undefined;
    targetAttr: Gtk.ConstraintAttribute;
    relation?: Gtk.ConstraintRelation;
    source?: Gtk.ConstraintTarget;
    sourceAttr?: Gtk.ConstraintAttribute;
    multiplier?: number;
    constant?: number;
    strength?: number;
}): Gtk.Constraint => {
    return new Gtk.Constraint(
        options.targetAttr,
        options.relation ?? Gtk.ConstraintRelation.EQ,
        options.sourceAttr ?? Gtk.ConstraintAttribute.NONE,
        options.multiplier ?? 1.0,
        options.constant ?? 0,
        options.strength ?? Gtk.ConstraintStrength.REQUIRED,
        options.target,
        options.source,
    );
};

/**
 * Demo showing multiplier usage for proportional layouts.
 */
const MultiplierDemo = () => {
    const containerRef = useRef<Gtk.Box | null>(null);
    const halfRef = useRef<Gtk.Button | null>(null);
    const thirdRef = useRef<Gtk.Button | null>(null);
    const quarterRef = useRef<Gtk.Button | null>(null);
    const layoutRef = useRef<Gtk.ConstraintLayout | null>(null);

    useEffect(() => {
        if (!containerRef.current || !halfRef.current || !thirdRef.current || !quarterRef.current) return;

        const layout = new Gtk.ConstraintLayout();
        layoutRef.current = layout;
        containerRef.current.setLayoutManager(layout);

        const buttons = [
            { ref: halfRef, multiplier: 0.5 },
            { ref: thirdRef, multiplier: 0.33 },
            { ref: quarterRef, multiplier: 0.25 },
        ];

        let yOffset = 8;
        for (const { ref, multiplier } of buttons) {
            const button = ref.current;
            if (!button) continue;

            // Left align
            layout.addConstraint(
                createConstraint({
                    target: button,
                    targetAttr: Gtk.ConstraintAttribute.START,
                    sourceAttr: Gtk.ConstraintAttribute.START,
                    constant: 8,
                }),
            );

            // Vertical position
            layout.addConstraint(
                createConstraint({
                    target: button,
                    targetAttr: Gtk.ConstraintAttribute.TOP,
                    sourceAttr: Gtk.ConstraintAttribute.TOP,
                    constant: yOffset,
                }),
            );

            // Width as fraction of parent width
            // button.width = parent.width * multiplier - margin
            layout.addConstraint(
                createConstraint({
                    target: button,
                    targetAttr: Gtk.ConstraintAttribute.WIDTH,
                    sourceAttr: Gtk.ConstraintAttribute.WIDTH,
                    multiplier: multiplier,
                    constant: -16, // Account for margins
                }),
            );

            yOffset += 45;
        }
    }, []);

    return (
        <GtkFrame label="Multiplier for Proportional Layouts">
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={8}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
            >
                <GtkLabel
                    label="Use multiplier to create proportional relationships. button.width = parent.width * multiplier"
                    cssClasses={["dim-label"]}
                    wrap
                    halign={Gtk.Align.START}
                />
                <GtkBox
                    ref={containerRef}
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={0}
                    widthRequest={400}
                    heightRequest={160}
                    cssClasses={["card"]}
                >
                    <GtkButton ref={halfRef} label="50% (mult=0.5)" />
                    <GtkButton ref={thirdRef} label="33% (mult=0.33)" />
                    <GtkButton ref={quarterRef} label="25% (mult=0.25)" />
                </GtkBox>
                <GtkLabel
                    label={"Formula: target.attr = source.attr * multiplier + constant"}
                    cssClasses={["monospace", "dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkFrame>
    );
};

/**
 * Demo showing ConstraintGuide usage.
 */
const GuideDemo = () => {
    const containerRef = useRef<Gtk.Box | null>(null);
    const leftRef = useRef<Gtk.Button | null>(null);
    const rightRef = useRef<Gtk.Button | null>(null);
    const layoutRef = useRef<Gtk.ConstraintLayout | null>(null);
    const guideRef = useRef<Gtk.ConstraintGuide | null>(null);
    const [guidePosition, setGuidePosition] = useState(50); // percentage

    useEffect(() => {
        if (!containerRef.current || !leftRef.current || !rightRef.current) return;

        // Create layout and guide only once
        if (!layoutRef.current) {
            const layout = new Gtk.ConstraintLayout();
            layoutRef.current = layout;
            containerRef.current.setLayoutManager(layout);

            // Create a guide that acts as a flexible divider
            const guide = new Gtk.ConstraintGuide();
            guideRef.current = guide;
            guide.setName("divider");
            guide.setMinSize(1, -1);
            guide.setNatSize(1, -1);
            guide.setMaxSize(1, -1);
            layout.addGuide(guide);
        }

        const layout = layoutRef.current;
        const guide = guideRef.current;
        if (!guide) return;

        // Remove old constraints before adding new ones
        // (no-op on first render since layout was just created)
        layout.removeAllConstraints();

        // Position guide as percentage of container width
        layout.addConstraint(
            createConstraint({
                target: guide,
                targetAttr: Gtk.ConstraintAttribute.START,
                sourceAttr: Gtk.ConstraintAttribute.WIDTH,
                multiplier: guidePosition / 100,
            }),
        );

        // Re-add all button constraints
        // Left button: from start to guide
        layout.addConstraint(
            createConstraint({
                target: leftRef.current,
                targetAttr: Gtk.ConstraintAttribute.START,
                sourceAttr: Gtk.ConstraintAttribute.START,
                constant: 8,
            }),
        );
        layout.addConstraint(
            createConstraint({
                target: leftRef.current,
                targetAttr: Gtk.ConstraintAttribute.END,
                source: guide,
                sourceAttr: Gtk.ConstraintAttribute.START,
                constant: -4,
            }),
        );
        layout.addConstraint(
            createConstraint({
                target: leftRef.current,
                targetAttr: Gtk.ConstraintAttribute.CENTER_Y,
                sourceAttr: Gtk.ConstraintAttribute.CENTER_Y,
            }),
        );

        // Right button: from guide to end
        layout.addConstraint(
            createConstraint({
                target: rightRef.current,
                targetAttr: Gtk.ConstraintAttribute.START,
                source: guide,
                sourceAttr: Gtk.ConstraintAttribute.END,
                constant: 4,
            }),
        );
        layout.addConstraint(
            createConstraint({
                target: rightRef.current,
                targetAttr: Gtk.ConstraintAttribute.END,
                sourceAttr: Gtk.ConstraintAttribute.END,
                constant: -8,
            }),
        );
        layout.addConstraint(
            createConstraint({
                target: rightRef.current,
                targetAttr: Gtk.ConstraintAttribute.CENTER_Y,
                sourceAttr: Gtk.ConstraintAttribute.CENTER_Y,
            }),
        );
    }, [guidePosition]);

    return (
        <GtkFrame label="Constraint Guides">
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={8}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
            >
                <GtkLabel
                    label="ConstraintGuides are invisible layout elements that can be used as constraint targets. Great for creating flexible dividers."
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
                    <GtkButton ref={leftRef} label="Left Panel" />
                    <GtkButton ref={rightRef} label="Right Panel" cssClasses={["suggested-action"]} />
                </GtkBox>
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
                    <GtkLabel label="Guide position:" />
                    <GtkButton
                        label="25%"
                        onClicked={() => setGuidePosition(25)}
                        cssClasses={guidePosition === 25 ? ["suggested-action"] : []}
                    />
                    <GtkButton
                        label="50%"
                        onClicked={() => setGuidePosition(50)}
                        cssClasses={guidePosition === 50 ? ["suggested-action"] : []}
                    />
                    <GtkButton
                        label="75%"
                        onClicked={() => setGuidePosition(75)}
                        cssClasses={guidePosition === 75 ? ["suggested-action"] : []}
                    />
                </GtkBox>
            </GtkBox>
        </GtkFrame>
    );
};

/**
 * Demo showing relation types (equality, inequality).
 */
const RelationDemo = () => {
    const containerRef = useRef<Gtk.Box | null>(null);
    const eqRef = useRef<Gtk.Button | null>(null);
    const geRef = useRef<Gtk.Button | null>(null);
    const leRef = useRef<Gtk.Button | null>(null);
    const layoutRef = useRef<Gtk.ConstraintLayout | null>(null);

    useEffect(() => {
        if (!containerRef.current || !eqRef.current || !geRef.current || !leRef.current) return;

        const layout = new Gtk.ConstraintLayout();
        layoutRef.current = layout;
        containerRef.current.setLayoutManager(layout);

        let yOffset = 8;

        // EQ button: width exactly 150
        layout.addConstraint(
            createConstraint({
                target: eqRef.current,
                targetAttr: Gtk.ConstraintAttribute.START,
                sourceAttr: Gtk.ConstraintAttribute.START,
                constant: 8,
            }),
        );
        layout.addConstraint(
            createConstraint({
                target: eqRef.current,
                targetAttr: Gtk.ConstraintAttribute.TOP,
                sourceAttr: Gtk.ConstraintAttribute.TOP,
                constant: yOffset,
            }),
        );
        layout.addConstraint(
            Gtk.Constraint.newConstant(
                Gtk.ConstraintAttribute.WIDTH,
                Gtk.ConstraintRelation.EQ, // width == 150
                150,
                Gtk.ConstraintStrength.REQUIRED,
                eqRef.current,
            ),
        );

        yOffset += 45;

        // GE button: width >= 100 (will try to be larger)
        layout.addConstraint(
            createConstraint({
                target: geRef.current,
                targetAttr: Gtk.ConstraintAttribute.START,
                sourceAttr: Gtk.ConstraintAttribute.START,
                constant: 8,
            }),
        );
        layout.addConstraint(
            createConstraint({
                target: geRef.current,
                targetAttr: Gtk.ConstraintAttribute.TOP,
                sourceAttr: Gtk.ConstraintAttribute.TOP,
                constant: yOffset,
            }),
        );
        layout.addConstraint(
            Gtk.Constraint.newConstant(
                Gtk.ConstraintAttribute.WIDTH,
                Gtk.ConstraintRelation.GE, // width >= 100
                100,
                Gtk.ConstraintStrength.REQUIRED,
                geRef.current,
            ),
        );

        yOffset += 45;

        // LE button: width <= 200 (capped at maximum)
        layout.addConstraint(
            createConstraint({
                target: leRef.current,
                targetAttr: Gtk.ConstraintAttribute.START,
                sourceAttr: Gtk.ConstraintAttribute.START,
                constant: 8,
            }),
        );
        layout.addConstraint(
            createConstraint({
                target: leRef.current,
                targetAttr: Gtk.ConstraintAttribute.TOP,
                sourceAttr: Gtk.ConstraintAttribute.TOP,
                constant: yOffset,
            }),
        );
        layout.addConstraint(
            Gtk.Constraint.newConstant(
                Gtk.ConstraintAttribute.WIDTH,
                Gtk.ConstraintRelation.LE, // width <= 200
                200,
                Gtk.ConstraintStrength.REQUIRED,
                leRef.current,
            ),
        );
        // Also set minimum to show it respects bounds
        layout.addConstraint(
            Gtk.Constraint.newConstant(
                Gtk.ConstraintAttribute.WIDTH,
                Gtk.ConstraintRelation.GE,
                80,
                Gtk.ConstraintStrength.REQUIRED,
                leRef.current,
            ),
        );
    }, []);

    return (
        <GtkFrame label="Constraint Relations">
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={8}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
            >
                <GtkLabel
                    label="Relations define how constraints compare values: EQ (equal), GE (greater or equal), LE (less or equal)."
                    cssClasses={["dim-label"]}
                    wrap
                    halign={Gtk.Align.START}
                />
                <GtkBox
                    ref={containerRef}
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={0}
                    widthRequest={350}
                    heightRequest={160}
                    cssClasses={["card"]}
                >
                    <GtkButton ref={eqRef} label="EQ: width == 150" />
                    <GtkButton ref={geRef} label="GE: width >= 100" cssClasses={["suggested-action"]} />
                    <GtkButton ref={leRef} label="LE: width <= 200" cssClasses={["destructive-action"]} />
                </GtkBox>
                <GtkLabel
                    label={`Relations:
EQ (0):  target.attr == source.attr * mult + const
GE (1):  target.attr >= source.attr * mult + const
LE (-1): target.attr <= source.attr * mult + const`}
                    cssClasses={["monospace", "dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkFrame>
    );
};

/**
 * Code example showing the builder pattern.
 */
const CodeExampleCard = () => {
    return (
        <GtkFrame label="Builder Pattern Code Example">
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={8}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
            >
                <GtkLabel
                    label="Typical constraint creation pattern:"
                    cssClasses={["heading"]}
                    halign={Gtk.Align.START}
                />
                <GtkLabel
                    label={`// Create layout manager
const layout = new Gtk.ConstraintLayout();
widget.setLayoutManager(layout);

// Create constraint with all parameters
const constraint = new Gtk.Constraint(
    targetAttribute,     // e.g., CENTER_X
    relation,            // EQ, GE, or LE
    sourceAttribute,     // e.g., CENTER_X
    multiplier,          // default 1.0
    constant,            // offset in pixels
    strength,            // REQUIRED, STRONG, MEDIUM, WEAK
    target,              // target widget
    source               // source widget (undefined for parent)
);

// Or use newConstant for simple size constraints
const sizeConstraint = Gtk.Constraint.newConstant(
    Gtk.ConstraintAttribute.WIDTH,
    Gtk.ConstraintRelation.GE,
    100,  // constant value
    Gtk.ConstraintStrength.REQUIRED,
    targetWidget
);

// Add constraints to layout
layout.addConstraint(constraint);
layout.addConstraint(sizeConstraint);`}
                    halign={Gtk.Align.START}
                    cssClasses={["monospace"]}
                    selectable
                />
            </GtkBox>
        </GtkFrame>
    );
};

const ConstraintsBuilderDemo = () => {
    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Building Constraints" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="This demo shows how to build constraints programmatically using the Constraint API. Each constraint is defined by target/source attributes, a relation, multiplier, constant, and strength."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <MultiplierDemo />
            <RelationDemo />
            <GuideDemo />
            <CodeExampleCard />
        </GtkBox>
    );
};

export const constraintsBuilderDemo: Demo = {
    id: "constraints-builder",
    title: "Building Constraints",
    description: "Programmatically create constraints with multipliers, constants, and strengths.",
    keywords: [
        "constraint",
        "builder",
        "multiplier",
        "constant",
        "strength",
        "guide",
        "GtkConstraint",
        "GtkConstraintGuide",
    ],
    component: ConstraintsBuilderDemo,
    sourceCode,
};
