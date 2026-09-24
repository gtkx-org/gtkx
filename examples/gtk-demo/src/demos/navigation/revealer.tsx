import * as Gtk from "@gtkx/gi/gtk";
import { GtkGrid, GtkGridLayoutChild, GtkImage, GtkRevealer } from "@gtkx/jsx/gtk";
import { useEffect, useState } from "react";
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

const isAnimated = (revealer: Gtk.Revealer): boolean =>
    revealer.getTransitionType() !== Gtk.RevealerTransitionType.NONE &&
    revealer.getTransitionDuration() > 0 &&
    Gtk.Settings.getDefault()?.gtkEnableAnimations === true;

function RevealerCell({ config, index }: RevealerCellProps) {
    const [isRevealed, setIsRevealed] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsRevealed(true);
        }, REVEAL_INTERVAL_MS * (index + 1));

        return () => {
            clearTimeout(timer);
        };
    }, [index]);

    return (
        <GtkGridLayoutChild column={config.column} row={config.row}>
            <GtkRevealer
                name={`revealer-${String(index)}`}
                transitionDuration={TRANSITION_DURATION}
                transitionType={config.transition}
                revealChild={isRevealed}
                onNotifyChildRevealed={(_childRevealed, self) => {
                    if (!self.getMapped() || !isAnimated(self)) {
                        return;
                    }

                    setIsRevealed((revealed) => !revealed);
                }}
            >
                <GtkImage
                    iconName="face-cool-symbolic"
                    iconSize={Gtk.IconSize.LARGE}
                    accessibleRole={Gtk.AccessibleRole.PRESENTATION}
                />
            </GtkRevealer>
        </GtkGridLayoutChild>
    );
}

function RevealerDemo() {
    return (
        <GtkGrid
            name="revealer-grid"
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.CENTER}
            accessibleRole={Gtk.AccessibleRole.IMG}
            accessibleLabel="Animated cool faces"
        >
            {revealerConfigs.map((config, index) => (
                <RevealerCell
                    key={`${String(config.column)}-${String(config.row)}`}
                    config={config}
                    index={index}
                />
            ))}
        </GtkGrid>
    );
}

export { revealerDemo };
