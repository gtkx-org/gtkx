import type * as Gtk from "@gtkx/gi/gtk";
import { GtkConstraintLayout } from "@gtkx/jsx/gtk";
import { useMemo } from "react";
import type { Demo } from "../types.js";
import { useChildButtons } from "./child-buttons.js";
import { ConstraintContainer } from "./constraint-helpers.js";
import sourceCode from "./constraints-vfl.tsx?raw";

const VFL_CONSTRAINTS = [
    "H:|-[button1(==button2)]-12-[button2]-|",
    "H:|-[button3]-|",
    "V:|-[button1]-12-[button3(==button1)]-|",
    "V:|-[button2]-12-[button3(==button2)]-|",
];

const constraintsVflDemo: Demo = {
    id: "constraints-vfl",
    title: "Constraints/VFL",
    description:
        "GtkConstraintLayout allows defining constraints using a compact syntax called Visual Format Language, or " +
        "VFL.\n\nA typical example of a VFL specification looks like " +
        "this:\n\nH:|-[button1(==button2)]-12-[button2]-|",
    keywords: [],
    component: ConstraintsVflDemo,
    sourceCode,
    defaultWidth: 260,
    windowTitle: "Constraints — VFL",
};

function ConstraintsVflDemo() {
    const [buttons, handlers] = useChildButtons();

    const views = useMemo(
        () =>
            buttons === null
                ? null
                : new Map<string, Gtk.ConstraintTarget>([
                        ["button1", buttons.button1],
                        ["button2", buttons.button2],
                        ["button3", buttons.button3],
                    ]),
        [buttons],
    );

    return (
        <ConstraintContainer
            handlers={handlers}
            layoutManager={(
                <GtkConstraintLayout
                    vfl={views && [{ lines: VFL_CONSTRAINTS, hspacing: 8, vspacing: 8, views }]}
                />
            )}
        />
    );
}

export { constraintsVflDemo };
