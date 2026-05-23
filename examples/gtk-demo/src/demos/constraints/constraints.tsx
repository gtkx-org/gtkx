import { registerClass } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Demo } from "../types.js";
import sourceCode from "./constraints.tsx?raw";

const SIMPLE_GRID_TYPE_NAME = "GtkxSimpleConstraintGrid";

type ConstraintTarget = Gtk.Widget | Gtk.ConstraintGuide | null;

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

const buildSpaceGuide = (layout: Gtk.ConstraintLayout): Gtk.ConstraintGuide => {
    const guide = new Gtk.ConstraintGuide();
    guide.setName("space");
    guide.setMinSize(10, 10);
    guide.setNatSize(100, 10);
    guide.setMaxSize(200, 20);
    guide.setStrength(Gtk.ConstraintStrength.STRONG);
    layout.addGuide(guide);
    return guide;
};

interface ConstraintBuildArgs {
    layout: Gtk.ConstraintLayout;
    button1: Gtk.Widget;
    button2: Gtk.Widget;
    button3: Gtk.Widget;
    guide: Gtk.ConstraintGuide;
}

const buildConstraints = ({ layout, button1, button2, button3, guide }: ConstraintBuildArgs): void => {
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

export class SimpleConstraintGrid extends Gtk.Widget {
    constructed(): void {
        const layout = new Gtk.ConstraintLayout();
        this.setLayoutManager(layout);

        const button1 = Gtk.Button.newWithLabel("Child 1");
        const button2 = Gtk.Button.newWithLabel("Child 2");
        const button3 = Gtk.Button.newWithLabel("Child 3");
        button1.setParent(this);
        button2.setParent(this);
        button3.setParent(this);

        const guide = buildSpaceGuide(layout);
        buildConstraints({ layout, button1, button2, button3, guide });
    }

    dispose(): void {
        let child: Gtk.Widget | null = this.getFirstChild();
        while (child) {
            const next: Gtk.Widget | null = child.getNextSibling();
            child.unparent();
            child = next;
        }
    }
}

registerClass(SimpleConstraintGrid, { gtypeName: SIMPLE_GRID_TYPE_NAME });

declare module "react" {
    namespace JSX {
        interface IntrinsicElements {
            GtkxSimpleConstraintGrid: {
                hexpand?: boolean;
                vexpand?: boolean;
                ref?: React.Ref<Gtk.Widget>;
                children?: React.ReactNode;
            };
        }
    }
}

const GtkxSimpleConstraintGrid = SIMPLE_GRID_TYPE_NAME;

const ConstraintsDemo = () => <GtkxSimpleConstraintGrid hexpand vexpand />;

export const constraintsDemo: Demo = {
    id: "constraints",
    title: "Constraints/Simple Constraints",
    description:
        "GtkConstraintLayout provides a layout manager that uses relations between widgets (also known as “constraints”) to compute the position and size of each child.\n\nIn addition to child widgets, the constraints can involve spacer objects (also known as “guides”). This example has a guide between the two buttons in the top row.\n\nTry resizing the window to see how the constraints react to update the layout.",
    keywords: ["GtkLayoutManager"],
    component: ConstraintsDemo,
    sourceCode,
    defaultWidth: 260,
};
