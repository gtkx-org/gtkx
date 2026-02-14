import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton } from "@gtkx/react";
import { useLayoutEffect, useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./constraints.tsx?raw";

const ConstraintsDemo = () => {
    const containerRef = useRef<Gtk.Box | null>(null);
    const button1Ref = useRef<Gtk.Button | null>(null);
    const button2Ref = useRef<Gtk.Button | null>(null);
    const button3Ref = useRef<Gtk.Button | null>(null);

    useLayoutEffect(() => {
        if (!containerRef.current || !button1Ref.current || !button2Ref.current || !button3Ref.current) return;

        const layout = new Gtk.ConstraintLayout();
        containerRef.current.setLayoutManager(layout);

        const guide = new Gtk.ConstraintGuide();
        guide.setName("space");
        guide.setMinSize(10, 10);
        guide.setNatSize(100, 10);
        guide.setMaxSize(200, 20);
        guide.setStrength(Gtk.ConstraintStrength.STRONG);
        layout.addGuide(guide);

        layout.addConstraint(
            Gtk.Constraint.newConstant(
                Gtk.ConstraintAttribute.WIDTH,
                Gtk.ConstraintRelation.LE,
                200,
                Gtk.ConstraintStrength.REQUIRED,
                button1Ref.current,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.START,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.START,
                1.0,
                8,
                Gtk.ConstraintStrength.REQUIRED,
                button1Ref.current,
                undefined,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.WIDTH,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.WIDTH,
                1.0,
                0,
                Gtk.ConstraintStrength.REQUIRED,
                button1Ref.current,
                button2Ref.current,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.END,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.START,
                1.0,
                0,
                Gtk.ConstraintStrength.REQUIRED,
                button1Ref.current,
                guide,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.END,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.START,
                1.0,
                0,
                Gtk.ConstraintStrength.REQUIRED,
                guide,
                button2Ref.current,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.END,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.END,
                1.0,
                -8,
                Gtk.ConstraintStrength.REQUIRED,
                button2Ref.current,
                undefined,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.START,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.START,
                1.0,
                8,
                Gtk.ConstraintStrength.REQUIRED,
                button3Ref.current,
                undefined,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.END,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.END,
                1.0,
                -8,
                Gtk.ConstraintStrength.REQUIRED,
                button3Ref.current,
                undefined,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.TOP,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.TOP,
                1.0,
                8,
                Gtk.ConstraintStrength.REQUIRED,
                button1Ref.current,
                undefined,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.TOP,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.TOP,
                1.0,
                8,
                Gtk.ConstraintStrength.REQUIRED,
                button2Ref.current,
                undefined,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.BOTTOM,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.TOP,
                1.0,
                -12,
                Gtk.ConstraintStrength.REQUIRED,
                button1Ref.current,
                button3Ref.current,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.BOTTOM,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.TOP,
                1.0,
                -12,
                Gtk.ConstraintStrength.REQUIRED,
                button2Ref.current,
                button3Ref.current,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.HEIGHT,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.HEIGHT,
                1.0,
                0,
                Gtk.ConstraintStrength.REQUIRED,
                button3Ref.current,
                button1Ref.current,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.HEIGHT,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.HEIGHT,
                1.0,
                0,
                Gtk.ConstraintStrength.REQUIRED,
                button3Ref.current,
                button2Ref.current,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.BOTTOM,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.BOTTOM,
                1.0,
                -8,
                Gtk.ConstraintStrength.REQUIRED,
                button3Ref.current,
                undefined,
            ),
        );
    }, []);

    return (
        <GtkBox ref={containerRef} hexpand vexpand>
            <GtkButton ref={button1Ref} label="Child 1" />
            <GtkButton ref={button2Ref} label="Child 2" />
            <GtkButton ref={button3Ref} label="Child 3" />
        </GtkBox>
    );
};

export const constraintsDemo: Demo = {
    id: "constraints",
    title: "Constraints/Simple Constraints",
    description:
        'GtkConstraintLayout provides a layout manager that uses relations between widgets (also known as "constraints") to compute the position and size of each child. In addition to child widgets, the constraints can involve spacer objects (also known as "guides"). This example has a guide between the two buttons in the top row. Try resizing the window to see how the constraints react to update the layout.',
    keywords: ["constraint", "layout", "GtkConstraintLayout", "GtkConstraint", "guide", "GtkLayoutManager"],
    component: ConstraintsDemo,
    sourceCode,
    defaultWidth: 260,
};
