import type * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkFixed, GtkFixedLayoutChild, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useRef } from "react";
import type { Demo } from "../types.js";
import { at } from "../../transform.js";
import { useTickCallback } from "../../use-tick-callback.js";
import sourceCode from "./fixed2.tsx?raw";

type FixedTransformRefs = {
    fixedRef: React.RefObject<Gtk.Fixed | null>;
    labelRef: React.RefObject<Gtk.Label | null>;
    startTimeRef: React.RefObject<number | null>;
};

const fixed2Demo: Demo = {
    id: "fixed2",
    title: "Fixed Layout / Transformations",
    description:
        "GtkFixed is a container that allows placing and transforming widgets manually.\n\n" +
        "This demo shows how to rotate and scale a child widget using a transform.",
    keywords: ["GtkLayoutManager"],
    component: Fixed2Demo,
    sourceCode,
    defaultWidth: 400,
    defaultHeight: 300,
    windowTitle: "Fixed Layout ‐ Transformations",
};

function orUndefined(transform: Gsk.Transform | null | undefined): Gsk.Transform | undefined {
    return transform ?? undefined;
}

function computeFixedTransform(
    duration: number,
    label: Gtk.Label | null,
    fixed: Gtk.Fixed | null,
): Gsk.Transform | undefined {
    const angle = duration * 90;
    const scale = 2 + Math.sin(duration * Math.PI);
    const labelWidth = label?.getWidth() ?? 50;
    const labelHeight = label?.getHeight() ?? 20;
    const containerWidth = fixed?.getWidth() ?? 400;
    const containerHeight = fixed?.getHeight() ?? 300;
    const centerPoint = new Graphene.Point();
    centerPoint.init(containerWidth / 2, containerHeight / 2);
    const offsetPoint = new Graphene.Point();
    offsetPoint.init(-labelWidth / 2, -labelHeight / 2);
    let t: Gsk.Transform | undefined = Gsk.Transform.new();
    t = orUndefined(t.translate(centerPoint));
    t = orUndefined(t?.rotate(angle));
    t = orUndefined(t?.scale(scale, scale));
    t = orUndefined(t?.translate(offsetPoint));

    return t;
}

function updateFixedTransform(refs: FixedTransformRefs, frameClock: Gdk.FrameClock) {
    const fixed = refs.fixedRef.current;
    const label = refs.labelRef.current;

    if (!fixed || !label) {
        return;
    }

    const now = Number(frameClock.getFrameTime());
    refs.startTimeRef.current ??= now;
    const duration = (now - refs.startTimeRef.current) / 1_000_000;
    const transform = computeFixedTransform(duration, label, fixed) ?? null;
    fixed.setChildTransform(label, transform);
}

function Fixed2Demo() {
    const startTimeRef = useRef<number | null>(null);
    const labelRef = useRef<Gtk.Label | null>(null);
    const fixedRef = useRef<Gtk.Fixed | null>(null);

    useTickCallback(fixedRef, (_widget, frameClock) => {
        updateFixedTransform({ fixedRef, labelRef, startTimeRef }, frameClock);

        return GLib.SOURCE_CONTINUE;
    });

    return (
        <GtkScrolledWindow name="scrolled" hexpand vexpand>
            <GtkFixed name="fixed" ref={fixedRef} hexpand vexpand overflow={Gtk.Overflow.VISIBLE}>
                <GtkFixedLayoutChild transform={at(0, 0)}>
                    <GtkLabel
                        ref={(node) => {
                            labelRef.current = node;
                        }}
                        name="fixed-label"
                    >
                        All fixed?
                    </GtkLabel>
                </GtkFixedLayoutChild>
            </GtkFixed>
        </GtkScrolledWindow>
    );
}

export { fixed2Demo };
