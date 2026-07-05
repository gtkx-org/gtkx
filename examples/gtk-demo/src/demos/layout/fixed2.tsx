import { Fixed } from "@gtkx/components";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useTickCallback } from "@gtkx/react";
import { useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./fixed2.tsx?raw";

const at = (x: number, y: number, transform?: Gsk.Transform | null): Gsk.Transform | null => {
    let composed = Gsk.Transform.new().translate(Graphene.Point.create(x, y));
    if (transform != null && composed !== null) composed = composed.transform(transform);
    return composed;
};

const computeFixedTransform = (
    duration: number,
    label: Gtk.Label | null,
    fixed: Gtk.Fixed | null,
): Gsk.Transform | undefined => {
    const angle = duration * 90;
    const scale = 2 + Math.sin(duration * Math.PI);

    const labelWidth = label?.getAllocatedWidth() ?? 50;
    const labelHeight = label?.getAllocatedHeight() ?? 20;
    const containerWidth = fixed?.getAllocatedWidth() ?? 400;
    const containerHeight = fixed?.getAllocatedHeight() ?? 300;

    const centerPoint = new Graphene.Point();
    centerPoint.init(containerWidth / 2, containerHeight / 2);

    const offsetPoint = new Graphene.Point();
    offsetPoint.init(-labelWidth / 2, -labelHeight / 2);

    let t: Gsk.Transform | undefined = Gsk.Transform.new();
    t = t.translate(centerPoint) ?? undefined;
    t = t?.rotate(angle) ?? undefined;
    t = t?.scale(scale, scale) ?? undefined;
    t = t?.translate(offsetPoint) ?? undefined;
    return t;
};

const Fixed2Demo = () => {
    const startTimeRef = useRef<number | null>(null);
    const labelRef = useRef<Gtk.Label | null>(null);
    const fixedRef = useRef<Gtk.Fixed | null>(null);

    useTickCallback(fixedRef, (_widget, frameClock) => {
        const fixed = fixedRef.current;
        const label = labelRef.current;
        if (!fixed || !label) return true;
        const now = Number(frameClock.getFrameTime());
        startTimeRef.current ??= now;
        const duration = (now - startTimeRef.current) / 1_000_000;
        const transform = computeFixedTransform(duration, label, fixed) ?? null;
        fixed.setChildTransform(label, transform);
        return true;
    });

    return (
        <GtkScrolledWindow name="scrolled" hexpand vexpand>
            <Fixed name="fixed" ref={fixedRef} hexpand vexpand overflow={Gtk.Overflow.VISIBLE}>
                <Fixed.Child transform={at(0, 0)}>
                    {(ref) => (
                        <GtkLabel
                            ref={(node) => {
                                ref(node);
                                labelRef.current = node;
                            }}
                            name="fixed-label"
                            label="All fixed?"
                        />
                    )}
                </Fixed.Child>
            </Fixed>
        </GtkScrolledWindow>
    );
};

export const fixed2Demo: Demo = {
    id: "fixed2",
    title: "Fixed Layout / Transformations",
    description:
        "GtkFixed is a container that allows placing and transforming widgets manually.\n\nThis demo shows how to rotate and scale a child widget using a transform.",
    keywords: ["GtkLayoutManager"],
    component: Fixed2Demo,
    sourceCode,
    defaultWidth: 400,
    defaultHeight: 300,
    windowTitle: "Fixed Layout ‐ Transformations",
};
