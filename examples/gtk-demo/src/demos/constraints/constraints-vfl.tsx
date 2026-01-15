import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton } from "@gtkx/react";
import { useEffect, useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./constraints-vfl.tsx?raw";

const ConstraintsVflDemo = () => {
    const containerRef = useRef<Gtk.Box | null>(null);
    const button1Ref = useRef<Gtk.Button | null>(null);
    const button2Ref = useRef<Gtk.Button | null>(null);
    const button3Ref = useRef<Gtk.Button | null>(null);

    useEffect(() => {
        if (!containerRef.current || !button1Ref.current || !button2Ref.current || !button3Ref.current) return;

        const layout = new Gtk.ConstraintLayout();
        containerRef.current.setLayoutManager(layout);

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
                Gtk.ConstraintAttribute.START,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.END,
                1.0,
                12,
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
                Gtk.ConstraintAttribute.TOP,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.BOTTOM,
                1.0,
                12,
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

export const constraintsVflDemo: Demo = {
    id: "constraints-vfl",
    title: "Constraints/VFL",
    description:
        "GtkConstraintLayout allows defining constraints using a compact syntax called Visual Format Language, or VFL. A typical example of a VFL specification looks like this: H:|-[button1(==button2)]-12-[button2]-|",
    keywords: ["constraint", "VFL", "visual format language", "GtkConstraintLayout", "layout"],
    component: ConstraintsVflDemo,
    sourceCode,
};
