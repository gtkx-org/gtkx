import * as Gtk from "@gtkx/ffi/gtk";
import { GtkGrid, GtkImage, GtkRevealer, x } from "@gtkx/react";
import { useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./revealer.tsx?raw";

interface RevealerConfig {
    column: number;
    row: number;
    transition: Gtk.RevealerTransitionType;
}

const revealerConfigs: RevealerConfig[] = [
    { column: 2, row: 2, transition: Gtk.RevealerTransitionType.CROSSFADE },
    { column: 2, row: 1, transition: Gtk.RevealerTransitionType.SLIDE_UP },
    { column: 3, row: 2, transition: Gtk.RevealerTransitionType.SLIDE_RIGHT },
    { column: 2, row: 3, transition: Gtk.RevealerTransitionType.SLIDE_DOWN },
    { column: 1, row: 2, transition: Gtk.RevealerTransitionType.SLIDE_LEFT },
    { column: 2, row: 0, transition: Gtk.RevealerTransitionType.SLIDE_UP },
    { column: 4, row: 2, transition: Gtk.RevealerTransitionType.SLIDE_RIGHT },
    { column: 2, row: 4, transition: Gtk.RevealerTransitionType.SLIDE_DOWN },
    { column: 0, row: 2, transition: Gtk.RevealerTransitionType.SLIDE_LEFT },
];

const TRANSITION_DURATION = 2000;
const STEP_DELAY = 200;

/**
 * Revealer demo matching the official GTK gtk-demo.
 * Shows 9 icons in a grid that reveal sequentially with different transitions.
 * Animation cycles: reveal one-by-one, then hide one-by-one.
 */
const RevealerDemo = () => {
    const [revealed, setRevealed] = useState<boolean[]>(new Array(9).fill(false));
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const indexRef = useRef(0);
    const revealingRef = useRef(true);

    useEffect(() => {
        const step = () => {
            const isRevealing = revealingRef.current;
            const index = indexRef.current;

            setRevealed((prev) => {
                const next = [...prev];
                next[index] = isRevealing;
                return next;
            });

            indexRef.current++;

            if (indexRef.current >= 9) {
                indexRef.current = 0;
                revealingRef.current = !revealingRef.current;
                timeoutRef.current = setTimeout(step, TRANSITION_DURATION + 1000);
            } else {
                timeoutRef.current = setTimeout(step, STEP_DELAY);
            }
        };

        timeoutRef.current = setTimeout(step, 500);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <GtkGrid halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
            {revealerConfigs.map((config, index) => (
                <x.GridChild key={`${config.column}-${config.row}`} column={config.column} row={config.row}>
                    <GtkRevealer
                        transitionDuration={TRANSITION_DURATION}
                        transitionType={config.transition}
                        revealChild={revealed[index]}
                    >
                        <GtkImage iconName="face-cool-symbolic" iconSize={Gtk.IconSize.LARGE} />
                    </GtkRevealer>
                </x.GridChild>
            ))}
        </GtkGrid>
    );
};

export const revealerDemo: Demo = {
    id: "revealer",
    title: "Revealer",
    description: "GtkRevealer is a container that animates showing and hiding of its sole child with nice transitions.",
    keywords: ["revealer", "GtkRevealer"],
    component: RevealerDemo,
    sourceCode,
};
