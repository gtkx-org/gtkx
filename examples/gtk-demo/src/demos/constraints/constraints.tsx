import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox } from "@gtkx/jsx/gtk";
import { GtkConstraintLayout } from "@gtkx/react";
import type { Demo } from "../types.js";
import { ConstraintChildButtons } from "./child-buttons.js";
import sourceCode from "./constraints.tsx?raw";

const A = Gtk.ConstraintAttribute;
const R = Gtk.ConstraintRelation;
const S = Gtk.ConstraintStrength;

const ConstraintsDemo = () => (
    <GtkBox
        name="container"
        hexpand
        vexpand
        layoutManager={
            <GtkConstraintLayout>
                <GtkConstraintLayout.Guide
                    id="space"
                    minWidth={10}
                    minHeight={10}
                    natWidth={100}
                    natHeight={10}
                    maxWidth={200}
                    maxHeight={20}
                    strength={S.STRONG}
                />
                <GtkConstraintLayout.Constraint
                    target="button1"
                    targetAttribute={A.WIDTH}
                    relation={R.LE}
                    sourceAttribute={A.NONE}
                    constant={200}
                />
                <GtkConstraintLayout.Constraint
                    target="button1"
                    targetAttribute={A.START}
                    sourceAttribute={A.START}
                    constant={8}
                />
                <GtkConstraintLayout.Constraint
                    target="button1"
                    targetAttribute={A.WIDTH}
                    source="button2"
                    sourceAttribute={A.WIDTH}
                />
                <GtkConstraintLayout.Constraint
                    target="button1"
                    targetAttribute={A.END}
                    source="space"
                    sourceAttribute={A.START}
                />
                <GtkConstraintLayout.Constraint
                    target="space"
                    targetAttribute={A.END}
                    source="button2"
                    sourceAttribute={A.START}
                />
                <GtkConstraintLayout.Constraint
                    target="button2"
                    targetAttribute={A.END}
                    sourceAttribute={A.END}
                    constant={-8}
                />
                <GtkConstraintLayout.Constraint
                    target="button3"
                    targetAttribute={A.START}
                    sourceAttribute={A.START}
                    constant={8}
                />
                <GtkConstraintLayout.Constraint
                    target="button3"
                    targetAttribute={A.END}
                    sourceAttribute={A.END}
                    constant={-8}
                />
                <GtkConstraintLayout.Constraint
                    target="button1"
                    targetAttribute={A.TOP}
                    sourceAttribute={A.TOP}
                    constant={8}
                />
                <GtkConstraintLayout.Constraint
                    target="button2"
                    targetAttribute={A.TOP}
                    sourceAttribute={A.TOP}
                    constant={8}
                />
                <GtkConstraintLayout.Constraint
                    target="button1"
                    targetAttribute={A.BOTTOM}
                    source="button3"
                    sourceAttribute={A.TOP}
                    constant={-12}
                />
                <GtkConstraintLayout.Constraint
                    target="button2"
                    targetAttribute={A.BOTTOM}
                    source="button3"
                    sourceAttribute={A.TOP}
                    constant={-12}
                />
                <GtkConstraintLayout.Constraint
                    target="button3"
                    targetAttribute={A.HEIGHT}
                    source="button1"
                    sourceAttribute={A.HEIGHT}
                />
                <GtkConstraintLayout.Constraint
                    target="button3"
                    targetAttribute={A.HEIGHT}
                    source="button2"
                    sourceAttribute={A.HEIGHT}
                />
                <GtkConstraintLayout.Constraint
                    target="button3"
                    targetAttribute={A.BOTTOM}
                    sourceAttribute={A.BOTTOM}
                    constant={-8}
                />
            </GtkConstraintLayout>
        }
    >
        <ConstraintChildButtons />
    </GtkBox>
);

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
