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

/**
 * Revealer demo matching the official GTK gtk-demo.
 * Shows 9 icons in a grid that reveal sequentially with different transitions.
 */
const RevealerDemo = () => {
    const [revealed, setRevealed] = useState<boolean[]>(new Array(9).fill(false));
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countRef = useRef(0);

    useEffect(() => {
        const animate = () => {
            if (countRef.current < 9) {
                setRevealed((prev) => {
                    const next = [...prev];
                    next[countRef.current] = true;
                    return next;
                });
                countRef.current++;
                timeoutRef.current = setTimeout(animate, 690);
            } else {
                timeoutRef.current = setTimeout(toggleAll, 2000);
            }
        };

        const toggleAll = () => {
            setRevealed((prev) => prev.map((v) => !v));
            timeoutRef.current = setTimeout(toggleAll, 2500);
        };

        timeoutRef.current = setTimeout(animate, 690);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <GtkGrid halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
            {revealerConfigs.map((config, index) => (
                <x.GridChild key={index} column={config.column} row={config.row}>
                    <GtkRevealer
                        transitionDuration={2000}
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
    description:
        "GtkRevealer is a container that animates showing and hiding of its sole child with nice transitions.",
    keywords: ["revealer", "GtkRevealer"],
    component: RevealerDemo,
    sourceCode,
};
