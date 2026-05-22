import * as Gtk from "@gtkx/ffi/gtk";
import { useLayoutEffect, useRef } from "react";
import type { Demo } from "../types.js";
import { ThreeButtonsBox } from "./_shared.js";
import sourceCode from "./constraints.tsx?raw";

type ConstraintTarget = Gtk.Widget | Gtk.ConstraintGuide | null;

const createSpaceGuide = (layout: Gtk.ConstraintLayout) => {
    const guide = new Gtk.ConstraintGuide();
    guide.setName("space");
    guide.setMinSize(10, 10);
    guide.setNatSize(100, 10);
    guide.setMaxSize(200, 20);
    guide.setStrength(Gtk.ConstraintStrength.STRONG);
    layout.addGuide(guide);
    return guide;
};

interface ConstraintArgs {
    target: ConstraintTarget;
    targetAttribute: Gtk.ConstraintAttribute;
    relation?: Gtk.ConstraintRelation;
    source: ConstraintTarget;
    sourceAttribute: Gtk.ConstraintAttribute;
    multiplier?: number;
    constant: number;
}

const addConstraint = (layout: Gtk.ConstraintLayout, args: ConstraintArgs) => {
    layout.addConstraint(
        Gtk.Constraint.new(
            args.target,
            args.targetAttribute,
            args.relation ?? Gtk.ConstraintRelation.EQ,
            args.source,
            args.sourceAttribute,
            args.multiplier ?? 1,
            args.constant,
            Gtk.ConstraintStrength.REQUIRED,
        ),
    );
};

interface ConstraintRefs {
    button1: Gtk.Button;
    button2: Gtk.Button;
    button3: Gtk.Button;
    guide: Gtk.ConstraintGuide;
}

const addAllConstraints = (layout: Gtk.ConstraintLayout, refs: ConstraintRefs) => {
    const { button1, button2, button3, guide } = refs;
    const A = Gtk.ConstraintAttribute;

    layout.addConstraint(
        Gtk.Constraint.newConstant(button1, A.WIDTH, Gtk.ConstraintRelation.LE, 200, Gtk.ConstraintStrength.REQUIRED),
    );

    const constraints: ConstraintArgs[] = [
        { target: button1, targetAttribute: A.START, source: null, sourceAttribute: A.START, constant: 8 },
        { target: button1, targetAttribute: A.WIDTH, source: button2, sourceAttribute: A.WIDTH, constant: 0 },
        { target: button1, targetAttribute: A.END, source: guide, sourceAttribute: A.START, constant: 0 },
        { target: guide, targetAttribute: A.END, source: button2, sourceAttribute: A.START, constant: 0 },
        { target: button2, targetAttribute: A.END, source: null, sourceAttribute: A.END, constant: -8 },
        { target: button3, targetAttribute: A.START, source: null, sourceAttribute: A.START, constant: 8 },
        { target: button3, targetAttribute: A.END, source: null, sourceAttribute: A.END, constant: -8 },
        { target: button1, targetAttribute: A.TOP, source: null, sourceAttribute: A.TOP, constant: 8 },
        { target: button2, targetAttribute: A.TOP, source: null, sourceAttribute: A.TOP, constant: 8 },
        { target: button1, targetAttribute: A.BOTTOM, source: button3, sourceAttribute: A.TOP, constant: -12 },
        { target: button2, targetAttribute: A.BOTTOM, source: button3, sourceAttribute: A.TOP, constant: -12 },
        { target: button3, targetAttribute: A.HEIGHT, source: button1, sourceAttribute: A.HEIGHT, constant: 0 },
        { target: button3, targetAttribute: A.HEIGHT, source: button2, sourceAttribute: A.HEIGHT, constant: 0 },
        { target: button3, targetAttribute: A.BOTTOM, source: null, sourceAttribute: A.BOTTOM, constant: -8 },
    ];
    for (const c of constraints) addConstraint(layout, c);
};

const ConstraintsDemo = () => {
    const containerRef = useRef<Gtk.Box | null>(null);
    const button1Ref = useRef<Gtk.Button | null>(null);
    const button2Ref = useRef<Gtk.Button | null>(null);
    const button3Ref = useRef<Gtk.Button | null>(null);

    useLayoutEffect(() => {
        const container = containerRef.current;
        const button1 = button1Ref.current;
        const button2 = button2Ref.current;
        const button3 = button3Ref.current;
        if (!container || !button1 || !button2 || !button3) return;

        const layout = new Gtk.ConstraintLayout();
        container.setLayoutManager(layout);
        const guide = createSpaceGuide(layout);
        addAllConstraints(layout, { button1, button2, button3, guide });
    }, []);

    return (
        <ThreeButtonsBox
            containerRef={containerRef}
            button1Ref={button1Ref}
            button2Ref={button2Ref}
            button3Ref={button3Ref}
        />
    );
};

export const constraintsDemo: Demo = {
    id: "constraints",
    title: "Constraints/Simple Constraints",
    description:
        "GtkConstraintLayout provides a layout manager that uses relations between widgets (also known as “constraints”) to compute the position and size of each child.\n\nIn addition to child widgets, the constraints can involve spacer objects (also known as “guides”). This example has a guide between the two buttons in the top row.\n\nTry resizing the window to see how the constraints react to update the layout.",
    keywords: ["gtkconstraintlayout", "gtklayoutmanager"],
    component: ConstraintsDemo,
    sourceCode,
    defaultWidth: 260,
};
