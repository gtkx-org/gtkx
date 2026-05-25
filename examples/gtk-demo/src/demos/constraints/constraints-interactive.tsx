import * as Gtk from "@gtkx/ffi/gtk";
import { type RefObject, useEffect, useRef } from "react";
import type { Demo } from "../types.js";
import { ThreeButtonsBox } from "./_shared.js";
import sourceCode from "./constraints-interactive.tsx?raw";

type ConstraintTarget = Gtk.Widget | Gtk.ConstraintGuide | null;

interface ConstraintArgs {
    target: ConstraintTarget;
    targetAttribute: Gtk.ConstraintAttribute;
    source: ConstraintTarget;
    sourceAttribute: Gtk.ConstraintAttribute;
    constant: number;
}

const addConstraint = (layout: Gtk.ConstraintLayout, args: ConstraintArgs) => {
    layout.addConstraint(
        Gtk.Constraint.new(
            args.target,
            args.targetAttribute,
            Gtk.ConstraintRelation.EQ,
            args.source,
            args.sourceAttribute,
            1,
            args.constant,
            Gtk.ConstraintStrength.REQUIRED,
        ),
    );
};

interface InteractiveRefs {
    button1: Gtk.Button;
    button2: Gtk.Button;
    button3: Gtk.Button;
    guide: Gtk.ConstraintGuide;
}

const addInteractiveConstraints = (layout: Gtk.ConstraintLayout, refs: InteractiveRefs) => {
    const { button1, button2, button3, guide } = refs;
    const A = Gtk.ConstraintAttribute;

    layout.addConstraint(
        Gtk.Constraint.newConstant(guide, A.WIDTH, Gtk.ConstraintRelation.EQ, 0, Gtk.ConstraintStrength.REQUIRED),
    );

    const constraints: ConstraintArgs[] = [
        { target: button1, targetAttribute: A.START, source: null, sourceAttribute: A.START, constant: 8 },
        { target: button1, targetAttribute: A.END, source: guide, sourceAttribute: A.START, constant: 0 },
        { target: button2, targetAttribute: A.START, source: guide, sourceAttribute: A.END, constant: 0 },
        { target: button2, targetAttribute: A.END, source: null, sourceAttribute: A.END, constant: -8 },
        { target: button3, targetAttribute: A.START, source: null, sourceAttribute: A.START, constant: 8 },
        { target: button3, targetAttribute: A.END, source: guide, sourceAttribute: A.START, constant: 0 },
        { target: button1, targetAttribute: A.TOP, source: null, sourceAttribute: A.TOP, constant: 8 },
        { target: button2, targetAttribute: A.TOP, source: button1, sourceAttribute: A.BOTTOM, constant: 0 },
        { target: button3, targetAttribute: A.TOP, source: button2, sourceAttribute: A.BOTTOM, constant: 0 },
        { target: button3, targetAttribute: A.BOTTOM, source: null, sourceAttribute: A.BOTTOM, constant: -8 },
    ];
    for (const c of constraints) addConstraint(layout, c);
};

interface DragControllerArgs {
    container: Gtk.Box;
    layoutRef: RefObject<Gtk.ConstraintLayout>;
    guideRef: RefObject<Gtk.ConstraintGuide>;
    constraintRef: RefObject<Gtk.Constraint | null>;
}

const attachDragController = ({ container, layoutRef, guideRef, constraintRef }: DragControllerArgs) => {
    const drag = new Gtk.GestureDrag();
    drag.on("drag-update", (_gesture: Gtk.GestureDrag, offsetX: number, _offsetY: number) => {
        if (!layoutRef.current || !guideRef.current) return;
        const [success, startX] = drag.getStartPoint();
        if (!success) return;

        if (constraintRef.current) {
            layoutRef.current.removeConstraint(constraintRef.current);
        }

        constraintRef.current = Gtk.Constraint.newConstant(
            guideRef.current,
            Gtk.ConstraintAttribute.LEFT,
            Gtk.ConstraintRelation.EQ,
            startX + offsetX,
            Gtk.ConstraintStrength.REQUIRED,
        );
        layoutRef.current.addConstraint(constraintRef.current);
        container.queueAllocate();
    });
    container.addController(drag);
};

function ConstraintsInteractive() {
    const containerRef = useRef<Gtk.Box>(null) as RefObject<Gtk.Box>;
    const button1Ref = useRef<Gtk.Button>(null) as RefObject<Gtk.Button>;
    const button2Ref = useRef<Gtk.Button>(null) as RefObject<Gtk.Button>;
    const button3Ref = useRef<Gtk.Button>(null) as RefObject<Gtk.Button>;
    const layoutRef = useRef<Gtk.ConstraintLayout>(null) as RefObject<Gtk.ConstraintLayout>;
    const guideRef = useRef<Gtk.ConstraintGuide>(null) as RefObject<Gtk.ConstraintGuide>;
    const constraintRef = useRef<Gtk.Constraint>(null) as RefObject<Gtk.Constraint | null>;

    useEffect(() => {
        const container = containerRef.current;
        const button1 = button1Ref.current;
        const button2 = button2Ref.current;
        const button3 = button3Ref.current;
        if (!container || !button1 || !button2 || !button3) return;

        const layout = new Gtk.ConstraintLayout();
        layoutRef.current = layout;
        container.setLayoutManager(layout);

        const guide = new Gtk.ConstraintGuide();
        guideRef.current = guide;
        layout.addGuide(guide);

        addInteractiveConstraints(layout, { button1, button2, button3, guide });
        attachDragController({ container, layoutRef, guideRef, constraintRef });
    }, []);

    return (
        <ThreeButtonsBox
            containerRef={containerRef}
            button1Ref={button1Ref}
            button2Ref={button2Ref}
            button3Ref={button3Ref}
            namedButtons
        />
    );
}

export const constraintsInteractiveDemo: Demo = {
    id: "constraints-interactive",
    title: "Constraints/Interactive Constraints",
    description:
        "This example shows how constraints can be updated during user interaction. The vertical edge between the buttons can be dragged with the mouse.",
    keywords: ["GtkConstraintLayout"],
    component: ConstraintsInteractive,
    sourceCode,
    defaultWidth: 260,
};
