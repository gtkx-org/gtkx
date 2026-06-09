import { GtkConstraintLayout } from "@gtkx/react";
import { GtkBox, GtkButton } from "@gtkx/react-gi/gtk";
import type { Demo } from "../types.js";
import sourceCode from "./constraints-vfl.tsx?raw";

const VFL_CONSTRAINTS = [
    "H:|-[button1(==button2)]-12-[button2]-|",
    "H:|-[button3]-|",
    "V:|-[button1]-12-[button3(==button1)]-|",
    "V:|-[button2]-12-[button3(==button2)]-|",
];

const ConstraintsVflDemo = () => (
    <GtkBox name="container" hexpand vexpand>
        <GtkConstraintLayout>
            <GtkConstraintLayout.Vfl lines={VFL_CONSTRAINTS} hspacing={8} vspacing={8} />
        </GtkConstraintLayout>
        <GtkConstraintLayout.Widget id="button1">
            <GtkButton name="button1" label="Child 1" />
        </GtkConstraintLayout.Widget>
        <GtkConstraintLayout.Widget id="button2">
            <GtkButton name="button2" label="Child 2" />
        </GtkConstraintLayout.Widget>
        <GtkConstraintLayout.Widget id="button3">
            <GtkButton name="button3" label="Child 3" />
        </GtkConstraintLayout.Widget>
    </GtkBox>
);

export const constraintsVflDemo: Demo = {
    id: "constraints-vfl",
    title: "Constraints/VFL",
    description:
        "GtkConstraintLayout allows defining constraints using a compact syntax called Visual Format Language, or VFL.\n\nA typical example of a VFL specification looks like this:\n\nH:|-[button1(==button2)]-12-[button2]-|",
    keywords: [],
    component: ConstraintsVflDemo,
    sourceCode,
    defaultWidth: 260,
    windowTitle: "Constraints — VFL",
};
