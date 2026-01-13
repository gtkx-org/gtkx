import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel } from "@gtkx/react";
import { useEffect, useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./constraints-vfl.tsx?raw";

/**
 * Demo showing equivalent constraint code for VFL patterns.
 * VFL (Visual Format Language) is a compact way to describe constraints.
 */

/**
 * Demonstrates horizontal layout: H:|-[button1]-[button2]-|
 */
const HorizontalLayoutDemo = () => {
    const containerRef = useRef<Gtk.Box | null>(null);
    const button1Ref = useRef<Gtk.Button | null>(null);
    const button2Ref = useRef<Gtk.Button | null>(null);
    const layoutRef = useRef<Gtk.ConstraintLayout | null>(null);

    useEffect(() => {
        if (!containerRef.current || !button1Ref.current || !button2Ref.current) return;

        const layout = new Gtk.ConstraintLayout();
        layoutRef.current = layout;
        containerRef.current.setLayoutManager(layout);
        const MARGIN = 8;
        const SPACING = 8;

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.START,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.START,
                1.0,
                MARGIN,
                Gtk.ConstraintStrength.REQUIRED,
                button1Ref.current,
                undefined,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.START,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.END,
                1.0,
                SPACING,
                Gtk.ConstraintStrength.REQUIRED,
                button2Ref.current,
                button1Ref.current,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.END,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.END,
                1.0,
                -MARGIN,
                Gtk.ConstraintStrength.REQUIRED,
                button2Ref.current,
                undefined,
            ),
        );

        for (const buttonRef of [button1Ref, button2Ref]) {
            const button = buttonRef.current;
            if (!button) continue;
            layout.addConstraint(
                new Gtk.Constraint(
                    Gtk.ConstraintAttribute.CENTER_Y,
                    Gtk.ConstraintRelation.EQ,
                    Gtk.ConstraintAttribute.CENTER_Y,
                    1.0,
                    0,
                    Gtk.ConstraintStrength.REQUIRED,
                    button,
                    undefined,
                ),
            );
        }
    }, []);

    return (
        <GtkFrame label="Horizontal Layout: H:|-[button1]-[button2]-|">
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={8}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
            >
                <GtkLabel
                    label="VFL creates a horizontal row with margins and spacing between widgets."
                    cssClasses={["dim-label"]}
                    wrap
                    halign={Gtk.Align.START}
                />
                <GtkBox ref={containerRef} widthRequest={350} heightRequest={60} cssClasses={["card"]}>
                    <GtkButton ref={button1Ref} label="Button 1" />
                    <GtkButton ref={button2Ref} label="Button 2" />
                </GtkBox>
                <GtkLabel
                    label={`Equivalent constraints:
 button1.start = parent.start + 8
 button2.start = button1.end + 8
 button2.end = parent.end - 8`}
                    cssClasses={["monospace", "dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkFrame>
    );
};

/**
 * Demonstrates explicit spacing: |-20-[widget]-50-|
 */
const ExplicitSpacingDemo = () => {
    const containerRef = useRef<Gtk.Box | null>(null);
    const widgetRef = useRef<Gtk.Button | null>(null);
    const layoutRef = useRef<Gtk.ConstraintLayout | null>(null);

    useEffect(() => {
        if (!containerRef.current || !widgetRef.current) return;

        const layout = new Gtk.ConstraintLayout();
        layoutRef.current = layout;
        containerRef.current.setLayoutManager(layout);

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.START,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.START,
                1.0,
                20,
                Gtk.ConstraintStrength.REQUIRED,
                widgetRef.current,
                undefined,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.END,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.END,
                1.0,
                -50,
                Gtk.ConstraintStrength.REQUIRED,
                widgetRef.current,
                undefined,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.CENTER_Y,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.CENTER_Y,
                1.0,
                0,
                Gtk.ConstraintStrength.REQUIRED,
                widgetRef.current,
                undefined,
            ),
        );
    }, []);

    return (
        <GtkFrame label="Explicit Spacing: |-20-[widget]-50-|">
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={8}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
            >
                <GtkLabel
                    label="Explicit pixel values in VFL override default spacing."
                    cssClasses={["dim-label"]}
                    wrap
                    halign={Gtk.Align.START}
                />
                <GtkBox ref={containerRef} widthRequest={350} heightRequest={60} cssClasses={["card"]}>
                    <GtkButton ref={widgetRef} label="20px left, 50px right" />
                </GtkBox>
                <GtkLabel
                    label={`Equivalent constraints:
 widget.start = parent.start + 20
 widget.end = parent.end - 50`}
                    cssClasses={["monospace", "dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkFrame>
    );
};

/**
 * Demonstrates size predicates: [widget(>=100)]
 */
const SizePredicatesDemo = () => {
    const containerRef = useRef<Gtk.Box | null>(null);
    const minWidthRef = useRef<Gtk.Button | null>(null);
    const fixedWidthRef = useRef<Gtk.Button | null>(null);
    const layoutRef = useRef<Gtk.ConstraintLayout | null>(null);

    useEffect(() => {
        if (!containerRef.current || !minWidthRef.current || !fixedWidthRef.current) return;

        const layout = new Gtk.ConstraintLayout();
        layoutRef.current = layout;
        containerRef.current.setLayoutManager(layout);
        const MARGIN = 8;
        const SPACING = 12;

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.START,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.START,
                1.0,
                MARGIN,
                Gtk.ConstraintStrength.REQUIRED,
                minWidthRef.current,
                undefined,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.START,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.END,
                1.0,
                SPACING,
                Gtk.ConstraintStrength.REQUIRED,
                fixedWidthRef.current,
                minWidthRef.current,
            ),
        );

        layout.addConstraint(
            Gtk.Constraint.newConstant(
                Gtk.ConstraintAttribute.WIDTH,
                Gtk.ConstraintRelation.GE,
                120,
                Gtk.ConstraintStrength.REQUIRED,
                minWidthRef.current,
            ),
        );

        layout.addConstraint(
            Gtk.Constraint.newConstant(
                Gtk.ConstraintAttribute.WIDTH,
                Gtk.ConstraintRelation.EQ,
                80,
                Gtk.ConstraintStrength.REQUIRED,
                fixedWidthRef.current,
            ),
        );

        for (const buttonRef of [minWidthRef, fixedWidthRef]) {
            const button = buttonRef.current;
            if (!button) continue;
            layout.addConstraint(
                new Gtk.Constraint(
                    Gtk.ConstraintAttribute.CENTER_Y,
                    Gtk.ConstraintRelation.EQ,
                    Gtk.ConstraintAttribute.CENTER_Y,
                    1.0,
                    0,
                    Gtk.ConstraintStrength.REQUIRED,
                    button,
                    undefined,
                ),
            );
        }
    }, []);

    return (
        <GtkFrame label="Size Predicates: [widget(>=120)] [widget(==80)]">
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={8}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
            >
                <GtkLabel
                    label="Size predicates define width/height constraints using>=, ==, <=."
                    cssClasses={["dim-label"]}
                    wrap
                    halign={Gtk.Align.START}
                />
                <GtkBox ref={containerRef} widthRequest={350} heightRequest={60} cssClasses={["card"]}>
                    <GtkButton ref={minWidthRef} label=">=120" cssClasses={["suggested-action"]} />
                    <GtkButton ref={fixedWidthRef} label="==80" />
                </GtkBox>
                <GtkLabel
                    label={`Equivalent constraints:
 minWidth.width>= 120
 fixedWidth.width == 80`}
                    cssClasses={["monospace", "dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkFrame>
    );
};

/**
 * Demonstrates vertical layout: V:|-[top]-[bottom]-|
 */
const VerticalLayoutDemo = () => {
    const containerRef = useRef<Gtk.Box | null>(null);
    const topRef = useRef<Gtk.Button | null>(null);
    const bottomRef = useRef<Gtk.Button | null>(null);
    const layoutRef = useRef<Gtk.ConstraintLayout | null>(null);

    useEffect(() => {
        if (!containerRef.current || !topRef.current || !bottomRef.current) return;

        const layout = new Gtk.ConstraintLayout();
        layoutRef.current = layout;
        containerRef.current.setLayoutManager(layout);
        const MARGIN = 8;
        const SPACING = 8;

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.TOP,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.TOP,
                1.0,
                MARGIN,
                Gtk.ConstraintStrength.REQUIRED,
                topRef.current,
                undefined,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.TOP,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.BOTTOM,
                1.0,
                SPACING,
                Gtk.ConstraintStrength.REQUIRED,
                bottomRef.current,
                topRef.current,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.BOTTOM,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.BOTTOM,
                1.0,
                -MARGIN,
                Gtk.ConstraintStrength.REQUIRED,
                bottomRef.current,
                undefined,
            ),
        );

        for (const buttonRef of [topRef, bottomRef]) {
            const button = buttonRef.current;
            if (!button) continue;
            layout.addConstraint(
                new Gtk.Constraint(
                    Gtk.ConstraintAttribute.CENTER_X,
                    Gtk.ConstraintRelation.EQ,
                    Gtk.ConstraintAttribute.CENTER_X,
                    1.0,
                    0,
                    Gtk.ConstraintStrength.REQUIRED,
                    button,
                    undefined,
                ),
            );
        }
    }, []);

    return (
        <GtkFrame label="Vertical Layout: V:|-[top]-[bottom]-|">
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={8}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
            >
                <GtkLabel
                    label="The V: prefix creates vertical constraints instead of horizontal."
                    cssClasses={["dim-label"]}
                    wrap
                    halign={Gtk.Align.START}
                />
                <GtkBox ref={containerRef} widthRequest={200} heightRequest={120} cssClasses={["card"]}>
                    <GtkButton ref={topRef} label="Top" />
                    <GtkButton ref={bottomRef} label="Bottom" />
                </GtkBox>
                <GtkLabel
                    label={`Equivalent constraints:
 top.top = parent.top + 8
 bottom.top = top.bottom + 8
 bottom.bottom = parent.bottom - 8`}
                    cssClasses={["monospace", "dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkFrame>
    );
};

/**
 * VFL Reference card showing syntax.
 */
const VflReferenceCard = () => {
    return (
        <GtkFrame label="VFL Quick Reference">
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={8}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
            >
                <GtkLabel label="Visual Format Language Syntax" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                    <GtkLabel
                        label={`H: Horizontal orientation (default)
V: Vertical orientation
| Superview (parent container)
- Standard spacing (default: 8px)
-N- N pixels spacing
[view] Widget reference
[view(N)] Widget with size = N
[view(>=N)] Widget with size>= N
[view(<=N)] Widget with size <= N
[view(==other)] Widget same size as other`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
                <GtkLabel label="Examples" cssClasses={["heading"]} halign={Gtk.Align.START} marginTop={8} />
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                    <GtkLabel
                        label={`H:|-[button]-| Full width with margins
H:[button1]-[button2] Standard spacing between
H:|-50-[box]-50-| 50px margins
V:[top]-10-[bottom] 10px vertical gap
[button(100)] Fixed width 100px
[button(>=70,<=100)] Width between 70-100
[btn1(==btn2)] Equal widths`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkBox>
        </GtkFrame>
    );
};

const ConstraintsVflDemo = () => {
    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Visual Format Language" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="VFL (Visual Format Language) provides a compact way to describe constraints using ASCII-art style strings. This demo shows the equivalent programmatic constraints for common VFL patterns."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <HorizontalLayoutDemo />
            <ExplicitSpacingDemo />
            <SizePredicatesDemo />
            <VerticalLayoutDemo />
            <VflReferenceCard />
        </GtkBox>
    );
};

export const constraintsVflDemo: Demo = {
    id: "constraints-vfl",
    title: "Visual Format Language",
    description: "VFL syntax reference and equivalent constraint code examples.",
    keywords: ["constraint", "VFL", "visual format language", "GtkConstraintLayout", "layout", "ASCII"],
    component: ConstraintsVflDemo,
    sourceCode,
};
