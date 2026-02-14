import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton } from "@gtkx/react";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./constraints-vfl.tsx?raw";

const VFL_CONSTRAINTS = [
    "H:|-[button1(==button2)]-12-[button2]-|",
    "H:|-[button3]-|",
    "V:|-[button1]-12-[button3(==button1)]-|",
    "V:|-[button2]-12-[button3(==button2)]-|",
];

const ConstraintsVflDemo = () => {
    const containerRef = useRef<Gtk.Box | null>(null);
    const button1Ref = useRef<Gtk.Button | null>(null);
    const button2Ref = useRef<Gtk.Button | null>(null);
    const button3Ref = useRef<Gtk.Button | null>(null);
    const layoutRef = useRef<Gtk.ConstraintLayout | null>(null);

    const applyConstraints = useCallback(() => {
        const container = containerRef.current;
        const button1 = button1Ref.current;
        const button2 = button2Ref.current;
        const button3 = button3Ref.current;

        if (!container || !button1 || !button2 || !button3) return;

        if (!layoutRef.current) {
            layoutRef.current = new Gtk.ConstraintLayout();
            container.setLayoutManager(layoutRef.current);
        }

        const layout = layoutRef.current;

        const views = new Map<string, Gtk.ConstraintTarget>([
            ["button1", button1],
            ["button2", button2],
            ["button3", button3],
        ]);

        try {
            layout.addConstraintsFromDescriptionv(VFL_CONSTRAINTS, VFL_CONSTRAINTS.length, 8, 8, views);
        } catch (e) {
            console.error("VFL parsing error:", e);
        }
    }, []);

    useLayoutEffect(() => {
        applyConstraints();
    }, [applyConstraints]);

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
        "GtkConstraintLayout allows defining constraints using a compact syntax called Visual Format Language, or VFL.",
    keywords: ["constraint", "VFL", "visual format language", "GtkConstraintLayout", "layout"],
    component: ConstraintsVflDemo,
    sourceCode,
    defaultWidth: 260,
};
