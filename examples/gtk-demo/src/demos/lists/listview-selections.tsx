import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkImage, GtkLabel, GtkScrolledWindow, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-selections.tsx?raw";

interface FruitItem {
    id: string;
    name: string;
    icon: string;
    color: string;
}

const fruits: FruitItem[] = [
    { id: "apple", name: "Apple", icon: "emoji-food-symbolic", color: "Red" },
    { id: "banana", name: "Banana", icon: "emoji-food-symbolic", color: "Yellow" },
    { id: "cherry", name: "Cherry", icon: "emoji-food-symbolic", color: "Red" },
    { id: "date", name: "Date", icon: "emoji-food-symbolic", color: "Brown" },
    { id: "elderberry", name: "Elderberry", icon: "emoji-food-symbolic", color: "Purple" },
    { id: "fig", name: "Fig", icon: "emoji-food-symbolic", color: "Purple" },
    { id: "grape", name: "Grape", icon: "emoji-food-symbolic", color: "Green" },
    { id: "honeydew", name: "Honeydew", icon: "emoji-food-symbolic", color: "Green" },
    { id: "kiwi", name: "Kiwi", icon: "emoji-food-symbolic", color: "Brown" },
    { id: "lemon", name: "Lemon", icon: "emoji-food-symbolic", color: "Yellow" },
    { id: "mango", name: "Mango", icon: "emoji-food-symbolic", color: "Orange" },
    { id: "nectarine", name: "Nectarine", icon: "emoji-food-symbolic", color: "Orange" },
    { id: "orange", name: "Orange", icon: "emoji-food-symbolic", color: "Orange" },
    { id: "papaya", name: "Papaya", icon: "emoji-food-symbolic", color: "Orange" },
    { id: "quince", name: "Quince", icon: "emoji-food-symbolic", color: "Yellow" },
    { id: "raspberry", name: "Raspberry", icon: "emoji-food-symbolic", color: "Red" },
    { id: "strawberry", name: "Strawberry", icon: "emoji-food-symbolic", color: "Red" },
    { id: "tomato", name: "Tomato", icon: "emoji-food-symbolic", color: "Red" },
    { id: "watermelon", name: "Watermelon", icon: "emoji-food-symbolic", color: "Green" },
];

const selectionModes = [
    {
        mode: Gtk.SelectionMode.NONE,
        label: "None",
        description: "No selection allowed",
    },
    {
        mode: Gtk.SelectionMode.SINGLE,
        label: "Single",
        description: "Select one item (click to toggle)",
    },
    {
        mode: Gtk.SelectionMode.BROWSE,
        label: "Browse",
        description: "Always have one item selected",
    },
    {
        mode: Gtk.SelectionMode.MULTIPLE,
        label: "Multiple",
        description: "Select multiple items (Ctrl+click, Shift+click)",
    },
];

const ListViewSelectionsDemo = () => {
    const [selectionMode, setSelectionMode] = useState(Gtk.SelectionMode.SINGLE);
    const [selected, setSelected] = useState<string[]>([]);
    const [lastActivated, setLastActivated] = useState<string | null>(null);

    const handleModeChange = (mode: Gtk.SelectionMode) => {
        setSelectionMode(mode);
        if (mode === Gtk.SelectionMode.NONE) {
            setSelected([]);
        } else if (mode === Gtk.SelectionMode.BROWSE && selected.length === 0) {
            setSelected([fruits[0]?.id ?? ""]);
        } else if (mode === Gtk.SelectionMode.SINGLE && selected.length > 1) {
            setSelected(selected.slice(0, 1));
        }
    };

    const handleActivate = (_list: Gtk.ListView, position: number) => {
        const item = fruits[position];
        if (item) {
            setLastActivated(item.name);
        }
    };

    const selectAll = () => {
        if (selectionMode === Gtk.SelectionMode.MULTIPLE) {
            setSelected(fruits.map((f) => f.id));
        }
    };

    const selectNone = () => {
        if (selectionMode !== Gtk.SelectionMode.BROWSE) {
            setSelected([]);
        }
    };

    const currentModeInfo = selectionModes.find((m) => m.mode === selectionMode);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Selection Modes" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Demonstrates the four GTK selection modes using GTKX's declarative selection props: selectionMode, selected, and onSelectionChanged."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Selection Mode">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={8}>
                        {selectionModes.map((m) => (
                            <GtkButton
                                key={m.mode}
                                label={m.label}
                                onClicked={() => handleModeChange(m.mode)}
                                cssClasses={selectionMode === m.mode ? ["suggested-action"] : ["flat"]}
                            />
                        ))}
                    </GtkBox>
                    <GtkLabel
                        label={currentModeInfo?.description ?? ""}
                        cssClasses={["dim-label"]}
                        halign={Gtk.Align.START}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Fruit Selection">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={8}>
                        <GtkButton
                            label="Select All"
                            onClicked={selectAll}
                            sensitive={selectionMode === Gtk.SelectionMode.MULTIPLE}
                            cssClasses={["flat"]}
                        />
                        <GtkButton
                            label="Select None"
                            onClicked={selectNone}
                            sensitive={
                                selectionMode !== Gtk.SelectionMode.BROWSE && selectionMode !== Gtk.SelectionMode.NONE
                            }
                            cssClasses={["flat"]}
                        />
                        <GtkLabel
                            label={`${selected.length} selected`}
                            cssClasses={["dim-label"]}
                            hexpand
                            halign={Gtk.Align.END}
                        />
                    </GtkBox>

                    <GtkScrolledWindow heightRequest={300} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                        <x.ListView<FruitItem>
                            estimatedItemHeight={48}
                            showSeparators
                            selectionMode={selectionMode}
                            selected={selected}
                            onSelectionChanged={setSelected}
                            onActivate={handleActivate}
                            renderItem={(item) => (
                                <GtkBox spacing={12} marginTop={8} marginBottom={8} marginStart={12} marginEnd={12}>
                                    <GtkImage iconName={item?.icon ?? ""} pixelSize={24} />
                                    <GtkLabel label={item?.name ?? ""} hexpand halign={Gtk.Align.START} />
                                    <GtkLabel label={item?.color ?? ""} cssClasses={["dim-label", "caption"]} />
                                </GtkBox>
                            )}
                        >
                            {fruits.map((fruit) => (
                                <x.ListItem key={fruit.id} id={fruit.id} value={fruit} />
                            ))}
                        </x.ListView>
                    </GtkScrolledWindow>

                    {lastActivated && (
                        <GtkLabel
                            label={`Last activated: ${lastActivated}`}
                            cssClasses={["dim-label", "caption"]}
                            halign={Gtk.Align.START}
                        />
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Selected Items">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    {selected.length === 0 ? (
                        <GtkLabel label="No items selected" cssClasses={["dim-label"]} halign={Gtk.Align.START} />
                    ) : (
                        <GtkBox spacing={8}>
                            {selected.map((id) => {
                                const fruit = fruits.find((f) => f.id === id);
                                return (
                                    <GtkBox
                                        key={id}
                                        spacing={4}
                                        cssClasses={["card"]}
                                        marginTop={4}
                                        marginBottom={4}
                                        marginStart={4}
                                        marginEnd={4}
                                    >
                                        <GtkLabel
                                            label={fruit?.name ?? id}
                                            marginStart={8}
                                            marginEnd={8}
                                            marginTop={4}
                                            marginBottom={4}
                                        />
                                    </GtkBox>
                                );
                            })}
                        </GtkBox>
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="How It Works" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="This demo uses GTKX's declarative selection API: the selectionMode prop sets the GTK selection model, the selected prop controls which items are selected, and onSelectionChanged receives updates when the user interacts with the list. GTK handles all keyboard navigation (Ctrl+click, Shift+click for ranges) automatically."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const listviewSelectionsDemo: Demo = {
    id: "listview-selections",
    title: "Lists/Selections",
    description: "ListView demonstrating NONE, SINGLE, BROWSE, and MULTIPLE selection modes",
    keywords: ["listview", "selection", "GtkListView", "single", "multiple", "browse", "none"],
    component: ListViewSelectionsDemo,
    sourceCode,
};
