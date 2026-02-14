import * as Gtk from "@gtkx/ffi/gtk";
import { GtkGrid, GtkImage, GtkRevealer, x } from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
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

/**
 * Revealer demo matching the official GTK gtk-demo.
 * Shows 9 icons in a grid that reveal sequentially (690ms apart),
 * then each independently oscillates via the child-revealed signal.
 */
const RevealerDemo = () => {
    const [revealed, setRevealed] = useState<boolean[]>(new Array(9).fill(false));
    const activatedRef = useRef<boolean[]>(new Array(9).fill(false));

    useEffect(() => {
        let count = 0;
        const timer = setInterval(() => {
            const idx = count;
            activatedRef.current[idx] = true;
            setRevealed((prev) => {
                const next = [...prev];
                next[idx] = true;
                return next;
            });
            count++;
            if (count >= 9) clearInterval(timer);
        }, 690);

        return () => clearInterval(timer);
    }, []);

    const handleChildRevealed = useCallback((index: number) => {
        if (!activatedRef.current[index]) return;
        setRevealed((prev) => {
            const next = [...prev];
            next[index] = !next[index];
            return next;
        });
    }, []);

    return (
        <GtkGrid halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
            {revealerConfigs.map((config, index) => (
                <x.GridChild key={`${config.column}-${config.row}`} column={config.column} row={config.row}>
                    <GtkRevealer
                        transitionDuration={TRANSITION_DURATION}
                        transitionType={config.transition}
                        revealChild={revealed[index]}
                        onNotify={(pspec, self) => {
                            if (pspec.getName() === "child-revealed") {
                                if (!self.getMapped()) return;
                                handleChildRevealed(index);
                            }
                        }}
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
    defaultWidth: 300,
    defaultHeight: 300,
};
