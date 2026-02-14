import type * as Gdk from "@gtkx/ffi/gdk";
import * as Graphene from "@gtkx/ffi/graphene";
import * as Gsk from "@gtkx/ffi/gsk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkFixed, GtkLabel, GtkScrolledWindow, x } from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./fixed2.tsx?raw";

const Fixed2Demo = () => {
    const startTimeRef = useRef<number | null>(null);
    const [transform, setTransform] = useState<Gsk.Transform | undefined>(undefined);
    const labelRef = useRef<Gtk.Label | null>(null);
    const fixedRef = useRef<Gtk.Fixed | null>(null);
    const tickIdRef = useRef<number | null>(null);

    const tickCallback = useCallback((_widget: Gtk.Widget, frameClock: Gdk.FrameClock): boolean => {
        const now = frameClock.getFrameTime();

        if (startTimeRef.current === null) {
            startTimeRef.current = now;
        }

        const duration = (now - startTimeRef.current) / 1_000_000;
        const angle = duration * 90;
        const scale = 2 + Math.sin(duration * Math.PI);

        const labelWidth = labelRef.current?.getAllocatedWidth() ?? 50;
        const labelHeight = labelRef.current?.getAllocatedHeight() ?? 20;
        const containerWidth = fixedRef.current?.getAllocatedWidth() ?? 400;
        const containerHeight = fixedRef.current?.getAllocatedHeight() ?? 300;

        const centerPoint = new Graphene.Point();
        centerPoint.init(containerWidth / 2, containerHeight / 2);

        const offsetPoint = new Graphene.Point();
        offsetPoint.init(-labelWidth / 2, -labelHeight / 2);

        let t: Gsk.Transform | undefined = new Gsk.Transform();
        t = t.translate(centerPoint) ?? undefined;
        t = t?.rotate(angle) ?? undefined;
        t = t?.scale(scale, scale) ?? undefined;
        t = t?.translate(offsetPoint) ?? undefined;

        setTransform(t);
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
        <GtkScrolledWindow hexpand vexpand>
            <GtkFixed ref={handleFixedRef} hexpand vexpand overflow={Gtk.Overflow.VISIBLE}>
                <x.FixedChild x={0} y={0} transform={transform}>
                    <GtkLabel ref={handleLabelRef} label="All fixed?" />
                </x.FixedChild>
            </GtkFixed>
        </GtkScrolledWindow>
    );
};

export const fixed2Demo: Demo = {
    id: "fixed2",
    title: "Fixed Layout / Transformations",
    description: "GtkFixed with GskTransform using GdkFrameClock for smooth animation.",
    keywords: ["fixed", "transform", "GskTransform", "GdkFrameClock", "addTickCallback", "animation"],
    component: Fixed2Demo,
    sourceCode,
    defaultWidth: 400,
    defaultHeight: 300,
};
