import { animated, useTransition } from "@gtkx/animated";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { useState } from "react";
import type { Demo } from "./types.js";

type Item = { key: number; label: string };
type ListState = { items: Item[]; nextKey: number };

const AnimatedLabel = animated(GtkLabel);
const SLOW = { duration: 300 };

const initialItems: Item[] = [
    { key: 1, label: "Item 1" },
    { key: 2, label: "Item 2" },
];

const initialState: ListState = { items: initialItems, nextKey: initialItems.length + 1 };

const transitionsDemo: Demo = {
    id: "transitions",
    title: "Transitions",
    description:
        "useTransition drives mount and unmount animations for a keyed list: entering items fade and slide in " +
        "from the start margin, and leaving items fade out before they are dropped. Add and Remove change the list.",
    component: TransitionsDemo,
};

function TransitionsDemo() {
    const [{ items }, setState] = useState(initialState);

    const transitions = useTransition(items, {
        keys: (item: Item) => item.key,
        from: { opacity: 0, marginStart: 32 },
        enter: { opacity: 1, marginStart: 0 },
        leave: { opacity: 0 },
        config: SLOW,
    });

    const addItem = () => {
        setState((current) => ({
            items: [...current.items, { key: current.nextKey, label: `Item ${String(current.nextKey)}` }],
            nextKey: current.nextKey + 1,
        }));
    };

    const removeItem = () => {
        setState((current) => ({ ...current, items: current.items.slice(0, -1) }));
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
            <GtkBox spacing={6}>
                <GtkButton label="Add" onClicked={addItem} />
                <GtkButton label="Remove" onClicked={removeItem} sensitive={items.length > 0} />
            </GtkBox>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                {transitions((styles, item) => (
                    <AnimatedLabel
                        opacity={styles.opacity}
                        marginStart={styles.marginStart}
                        label={item.label}
                        halign={Gtk.Align.START}
                    />
                ))}
            </GtkBox>
        </GtkBox>
    );
}

export { transitionsDemo };
