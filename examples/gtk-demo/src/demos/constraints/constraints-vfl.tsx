import { ConstraintLayout } from "@gtkx/components";
import { GtkBox } from "@gtkx/jsx/gtk";
import type { Demo } from "../types.js";
import { ConstraintChildButtons } from "./child-buttons.js";
import sourceCode from "./constraints-vfl.tsx?raw";

const VFL_CONSTRAINTS = [
    "H:|-[button1(==button2)]-12-[button2]-|",
    "H:|-[button3]-|",
    "V:|-[button1]-12-[button3(==button1)]-|",
    "V:|-[button2]-12-[button3(==button2)]-|",
];

const ConstraintsVflDemo = () => (
    <GtkBox
        name="container"
        hexpand
        vexpand
        layoutManager={
            <ConstraintLayout>
                <ConstraintLayout.Vfl lines={VFL_CONSTRAINTS} hspacing={8} vspacing={8} />
            </ConstraintLayout>
        }
    >
        <ConstraintChildButtons />
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
