import {
    animated,
    type SpringRef,
    type SpringValue,
    type SpringValues,
    useChain,
    useSpring,
    useSpringRef,
    useTrail,
} from "@gtkx/animated";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkToggleButton } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "./types.js";

type ItemTargets = { opacity: number; marginStart: number };

type ChainPlan = {
    panelOpacity: number;
    itemTargets: ItemTargets;
    order: [SpringRef, SpringRef];
    times: [number, number];
    replayPanel: { opacity: number };
    replayItems: ItemTargets;
};

type ChainControlsProps = {
    isOpen: boolean;
    onToggle: (button: Gtk.ToggleButton) => void;
    onReplay: () => void;
};

type ChainPanelProps = {
    opacity: SpringValue<number>;
    trail: SpringValues<ItemTargets>[];
};

const AnimatedBox = animated(GtkBox);
const AnimatedLabel = animated(GtkLabel);
const ITEMS = ["Espresso", "Cappuccino", "Latte", "Mocha"];
const ITEM_SHOWN = { opacity: 1, marginStart: 12 };
const ITEM_HIDDEN = { opacity: 0, marginStart: 36 };
const PANEL_CONFIG = { duration: 400 };
const ITEM_CONFIG = { duration: 300 };

const chainDemo: Demo = {
    id: "chain",
    title: "Chained Sequences",
    description:
        "Sequences two stages with useChain and useSpringRef: a useSpring fades the panel in before a useTrail " +
        "staggers its items, and toggling off reverses the order so the items leave before the panel.",
    component: ChainDemo,
};

const increment = (count: number): number => count + 1;

function planFor(isOpen: boolean, panelRef: SpringRef, trailRef: SpringRef): ChainPlan {
    if (isOpen) {
        return {
            panelOpacity: 1,
            itemTargets: ITEM_SHOWN,
            order: [panelRef, trailRef],
            times: [0, 0.4],
            replayPanel: { opacity: 0 },
            replayItems: ITEM_HIDDEN,
        };
    }

    return {
        panelOpacity: 0,
        itemTargets: ITEM_HIDDEN,
        order: [trailRef, panelRef],
        times: [0, 0.8],
        replayPanel: { opacity: 1 },
        replayItems: ITEM_SHOWN,
    };
}

function ChainControls({ isOpen, onToggle, onReplay }: ChainControlsProps) {
    return (
        <GtkBox spacing={6}>
            <GtkToggleButton name="chain-toggle" label="Show items" active={isOpen} onToggled={onToggle} />
            <GtkButton name="chain-replay" label="Replay" onClicked={onReplay} />
        </GtkBox>
    );
}

function ChainPanel({ opacity, trail }: ChainPanelProps) {
    return (
        <AnimatedBox
            name="chain-panel"
            opacity={opacity}
            orientation={Gtk.Orientation.VERTICAL}
            spacing={6}
            cssClasses={["card"]}
        >
            {trail.map((styles, index) => (
                <AnimatedLabel
                    key={ITEMS[index] ?? String(index)}
                    opacity={styles.opacity}
                    marginStart={styles.marginStart}
                    marginTop={6}
                    marginBottom={6}
                    marginEnd={12}
                    halign={Gtk.Align.START}
                    label={ITEMS[index] ?? ""}
                />
            ))}
        </AnimatedBox>
    );
}

function ChainDemo() {
    const [isOpen, setIsOpen] = useState(true);
    const [, setReplays] = useState(0);
    const panelRef = useSpringRef();
    const trailRef = useSpringRef();
    const plan = planFor(isOpen, panelRef, trailRef);

    const panel = useSpring({
        ref: panelRef,
        from: { opacity: 0 },
        to: { opacity: plan.panelOpacity },
        config: PANEL_CONFIG,
    });

    const trail = useTrail(ITEMS.length, {
        ref: trailRef,
        from: ITEM_HIDDEN,
        to: plan.itemTargets,
        config: ITEM_CONFIG,
    });

    useChain(plan.order, plan.times);

    const replay = (): void => {
        panelRef.set(plan.replayPanel);
        trailRef.set(plan.replayItems);
        setReplays(increment);
    };

    const toggle = (button: Gtk.ToggleButton): void => {
        setIsOpen(button.getActive());
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <ChainControls isOpen={isOpen} onToggle={toggle} onReplay={replay} />
            <ChainPanel opacity={panel.opacity} trail={trail} />
        </GtkBox>
    );
}

export { chainDemo };
