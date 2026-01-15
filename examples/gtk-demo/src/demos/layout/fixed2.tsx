import * as Graphene from "@gtkx/ffi/graphene";
import * as Gsk from "@gtkx/ffi/gsk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkFixed, GtkLabel, GtkScrolledWindow, x } from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./fixed2.tsx?raw";

const CONTAINER_WIDTH = 400;
const CONTAINER_HEIGHT = 300;

/**
 * Fixed Layout / Transformations demo matching the official GTK gtk-demo.
 * Shows how to rotate and scale a child widget using a transform.
 */
const Fixed2Demo = () => {
    const startTimeRef = useRef(Date.now());
    const [transform, setTransform] = useState<Gsk.Transform | undefined>(undefined);
    const labelRef = useRef<Gtk.Label | null>(null);

    const updateTransform = useCallback(() => {
        const duration = (Date.now() - startTimeRef.current) / 1000;
        const angle = duration * 90;
        const scale = 2 + Math.sin(duration * Math.PI);

        const labelWidth = labelRef.current?.getAllocatedWidth() ?? 50;
        const labelHeight = labelRef.current?.getAllocatedHeight() ?? 20;

        const centerPoint = new Graphene.Point();
        centerPoint.init(CONTAINER_WIDTH / 2, CONTAINER_HEIGHT / 2);

        const offsetPoint = new Graphene.Point();
        offsetPoint.init(-labelWidth / 2, -labelHeight / 2);

        let t: Gsk.Transform | undefined = new Gsk.Transform();
        t = t.translate(centerPoint) ?? undefined;
        t = t?.rotate(angle) ?? undefined;
        t = t?.scale(scale, scale) ?? undefined;
        t = t?.translate(offsetPoint) ?? undefined;

        setTransform(t);
    }, []);

    useEffect(() => {
        startTimeRef.current = Date.now();
        const interval = setInterval(updateTransform, 16);
        return () => clearInterval(interval);
    }, [updateTransform]);

    const handleLabelRef = useCallback((label: Gtk.Label | null) => {
        labelRef.current = label;
    }, []);

    return (
        <GtkScrolledWindow hexpand vexpand>
            <GtkFixed widthRequest={CONTAINER_WIDTH} heightRequest={CONTAINER_HEIGHT} overflow={Gtk.Overflow.VISIBLE}>
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
    description: "GtkFixed is a container that allows placing and transforming widgets manually.",
    keywords: ["fixed", "transform", "GskTransform", "GtkLayoutManager"],
    component: Fixed2Demo,
    sourceCode,
};
