import type * as Gdk from "@gtkx/gi/gdk";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkFixed, GtkFixedChild, GtkLabel, GtkScrolledWindow } from "@gtkx/react";
import { useCallback, useEffect, useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./fixed2.tsx?raw";

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
    const tickIdRef = useRef<number | null>(null);

    const tickCallback = useCallback((_widget: Gtk.Widget, frameClock: Gdk.FrameClock): boolean => {
        const fixed = fixedRef.current;
        const label = labelRef.current;
        if (!fixed || !label) return true;
        const now = frameClock.getFrameTime();
        startTimeRef.current ??= now;
        const duration = (now - startTimeRef.current) / 1_000_000;
        const transform = computeFixedTransform(duration, label, fixed) ?? null;
        fixed.setChildTransform(label, transform);
        return true;
    }, []);

    useEffect(() => {
        const fixed = fixedRef.current;
        if (!fixed) return;
        startTimeRef.current = null;
        tickIdRef.current = fixed.addTickCallback(tickCallback);
        return () => {
            if (tickIdRef.current !== null) {
                fixed.removeTickCallback(tickIdRef.current);
                tickIdRef.current = null;
            }
        };
    }, [tickCallback]);

    const handleLabelRef = useCallback((label: Gtk.Label | null) => {
        labelRef.current = label;
    }, []);

    const handleFixedRef = useCallback((fixed: Gtk.Fixed | null) => {
        fixedRef.current = fixed;
    }, []);

    return (
        <GtkScrolledWindow name="scrolled" hexpand vexpand>
            <GtkFixed name="fixed" ref={handleFixedRef} hexpand vexpand overflow={Gtk.Overflow.VISIBLE}>
                <GtkFixedChild x={0} y={0}>
                    <GtkLabel ref={handleLabelRef} name="fixed-label" label="All fixed?" />
                </GtkFixedChild>
            </GtkFixed>
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
