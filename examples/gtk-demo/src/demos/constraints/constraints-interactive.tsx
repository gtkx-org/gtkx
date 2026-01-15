import { createRef } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton } from "@gtkx/react";
import { useEffect, useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./constraints-interactive.tsx?raw";

const ConstraintsInteractiveDemo = () => {
    const containerRef = useRef<Gtk.Box | null>(null);
    const button1Ref = useRef<Gtk.Button | null>(null);
    const button2Ref = useRef<Gtk.Button | null>(null);
    const button3Ref = useRef<Gtk.Button | null>(null);
    const guideRef = useRef<Gtk.ConstraintGuide | null>(null);
    const constraintRef = useRef<Gtk.Constraint | null>(null);
    const layoutRef = useRef<Gtk.ConstraintLayout | null>(null);

    useEffect(() => {
        if (!containerRef.current || !button1Ref.current || !button2Ref.current || !button3Ref.current) return;

        const layout = new Gtk.ConstraintLayout();
        layoutRef.current = layout;
        containerRef.current.setLayoutManager(layout);

        const guide = new Gtk.ConstraintGuide();
        guideRef.current = guide;
        layout.addGuide(guide);

        layout.addConstraint(
            Gtk.Constraint.newConstant(
                Gtk.ConstraintAttribute.WIDTH,
                Gtk.ConstraintRelation.EQ,
                0,
                Gtk.ConstraintStrength.REQUIRED,
                guide,
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
                Gtk.ConstraintAttribute.START,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.END,
                1.0,
                0,
                Gtk.ConstraintStrength.REQUIRED,
                button2Ref.current,
                guide,
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
                Gtk.ConstraintAttribute.START,
                1.0,
                0,
                Gtk.ConstraintStrength.REQUIRED,
                button3Ref.current,
                guide,
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
                Gtk.ConstraintAttribute.BOTTOM,
                1.0,
                0,
                Gtk.ConstraintStrength.REQUIRED,
                button2Ref.current,
                button1Ref.current,
            ),
        );

        layout.addConstraint(
            new Gtk.Constraint(
                Gtk.ConstraintAttribute.TOP,
                Gtk.ConstraintRelation.EQ,
                Gtk.ConstraintAttribute.BOTTOM,
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

        const drag = new Gtk.GestureDrag();
        drag.connect("drag-update", (_gesture: Gtk.GestureDrag, offsetX: number) => {
            if (!layoutRef.current || !guideRef.current) return;

            const startXRef = createRef(0);
            const success = drag.getStartPoint(startXRef, null);
            if (!success) return;

            const startX = startXRef.value;

            if (constraintRef.current) {
                layoutRef.current.removeConstraint(constraintRef.current);
            }

            constraintRef.current = Gtk.Constraint.newConstant(
                Gtk.ConstraintAttribute.LEFT,
                Gtk.ConstraintRelation.EQ,
                startX + offsetX,
                Gtk.ConstraintStrength.REQUIRED,
                guideRef.current,
            );
            layoutRef.current.addConstraint(constraintRef.current);
            containerRef.current?.queueAllocate();
        });
        containerRef.current.addController(drag);
    }, []);

    return (
        <GtkBox ref={containerRef} hexpand vexpand>
            <GtkButton ref={button1Ref} label="Child 1" />
            <GtkButton ref={button2Ref} label="Child 2" />
            <GtkButton ref={button3Ref} label="Child 3" />
        </GtkBox>
    );
};

export const constraintsInteractiveDemo: Demo = {
    id: "constraints-interactive",
    title: "Constraints/Interactive Constraints",
    description:
        "This example shows how constraints can be updated during user interaction. The vertical edge between the buttons can be dragged with the mouse.",
    keywords: ["constraint", "interactive", "drag", "GtkConstraintLayout", "GtkLayoutManager"],
    component: ConstraintsInteractiveDemo,
    sourceCode,
};
