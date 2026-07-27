import * as Gtk from "@gtkx/gi/gtk";
import { GtkGrid, GtkGridLayoutChild, GtkImage, GtkRevealer } from "@gtkx/jsx/gtk";
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./revealer.tsx?raw";

type RevealerConfig = {
    column: number;
    row: number;
    transition: Gtk.RevealerTransitionType;
};

type RevealerCellProps = {
    config: RevealerConfig;
    index: number;
    isRevealed: boolean;
    onChildRevealed: (index: number) => void;
};

const revealerConfigs: RevealerConfig[] = [
    { column: 2, row: 2, transition: Gtk.RevealerTransitionType.CROSSFADE },
    { column: 2, row: 1, transition: Gtk.RevealerTransitionType.SLIDE_UP },
    { column: 3, row: 2, transition: Gtk.RevealerTransitionType.SLIDE_RIGHT },
    { column: 2, row: 3, transition: Gtk.RevealerTransitionType.NONE },
    { column: 1, row: 2, transition: Gtk.RevealerTransitionType.SLIDE_LEFT },
    { column: 2, row: 0, transition: Gtk.RevealerTransitionType.SLIDE_UP },
    { column: 4, row: 2, transition: Gtk.RevealerTransitionType.SLIDE_RIGHT },
    { column: 2, row: 4, transition: Gtk.RevealerTransitionType.NONE },
    { column: 0, row: 2, transition: Gtk.RevealerTransitionType.SLIDE_LEFT },
];

const TRANSITION_DURATION = 2000;
const REVEAL_INTERVAL_MS = 690;

const revealerDemo: Demo = {
    id: "revealer",
    title: "Revealer",
    description:
        "GtkRevealer is a container that animates showing and hiding of its sole child with nice transitions.",
    keywords: [],
    component: RevealerDemo,
    sourceCode,
    defaultWidth: 300,
    defaultHeight: 300,
};

const isFlagSet = (flags: boolean[], index: number): boolean => flags[index] === true;

const withFlag = (flags: boolean[], index: number, isSet: boolean): boolean[] => {
    const next = [...flags];
    next[index] = isSet;

    return next;
};

const revealAt = (activated: boolean[], setRevealed: Dispatch<SetStateAction<boolean[]>>, index: number) => {
    activated[index] = true;
    setRevealed((prev) => withFlag(prev, index, true));
};

const toggleRevealedAt = (
    activated: boolean[],
    setRevealed: Dispatch<SetStateAction<boolean[]>>,
    index: number,
) => {
    if (!isFlagSet(activated, index)) {
        return;
    }

    setRevealed((prev) => withFlag(prev, index, !isFlagSet(prev, index)));
};

const RevealerCell = ({ config, index, isRevealed, onChildRevealed }: RevealerCellProps) => (
    <GtkGridLayoutChild column={config.column} row={config.row}>
        <GtkRevealer
            name={`revealer-${String(index)}`}
            transitionDuration={TRANSITION_DURATION}
            transitionType={config.transition}
            revealChild={isRevealed}
            onNotifyChildRevealed={(_childRevealed, self) => {
                if (!self.getMapped()) {
                    return;
                }

                onChildRevealed(index);
            }}
        >
            <GtkImage iconName="face-cool-symbolic" iconSize={Gtk.IconSize.LARGE} />
        </GtkRevealer>
    </GtkGridLayoutChild>
);

function RevealerDemo() {
    const [revealed, setRevealed] = useState<boolean[]>(Array.from(revealerConfigs, () => false));
    const activatedRef = useRef<boolean[]>(Array.from(revealerConfigs, () => false));

    useEffect(() => {
        let count = 0;

        const timer = setInterval(() => {
            revealAt(activatedRef.current, setRevealed, count);
            count++;

            if (count >= revealerConfigs.length) {
                clearInterval(timer);
            }
        }, REVEAL_INTERVAL_MS);

        return () => {
            clearInterval(timer);
        };
    }, []);

    const handleChildRevealed = (index: number) => {
        toggleRevealedAt(activatedRef.current, setRevealed, index);
    };

    return (
        <GtkGrid name="revealer-grid" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
            {revealerConfigs.map((config, index) => (
                <RevealerCell
                    key={`${String(config.column)}-${String(config.row)}`}
                    config={config}
                    index={index}
                    isRevealed={isFlagSet(revealed, index)}
                    onChildRevealed={handleChildRevealed}
                />
            ))}
        </GtkGrid>
    );
}

export { revealerDemo };
