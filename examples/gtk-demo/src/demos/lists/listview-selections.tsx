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

type SelectionMode = "NONE" | "SINGLE" | "BROWSE" | "MULTIPLE";

const selectionModes: { mode: SelectionMode; label: string; description: string }[] = [
    { mode: "NONE", label: "None", description: "No selection allowed" },
    { mode: "SINGLE", label: "Single", description: "Select one item (click to toggle)" },
    { mode: "BROWSE", label: "Browse", description: "Always have one item selected" },
    { mode: "MULTIPLE", label: "Multiple", description: "Select multiple items (Ctrl+click, Shift+click)" },
];

const ListViewSelectionsDemo = () => {
    const [selectionMode, setSelectionMode] = useState<SelectionMode>("SINGLE");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [lastActivated, setLastActivated] = useState<string | null>(null);

    const handleActivate = (_list: Gtk.ListView, position: number) => {
        const item = fruits[position];
        if (item) {
            setLastActivated(item.name);
            if (selectionMode === "SINGLE") {
                if (selectedIds.has(item.id)) {
                    setSelectedIds(new Set());
                } else {
                    setSelectedIds(new Set([item.id]));
                }
            } else if (selectionMode === "BROWSE") {
                setSelectedIds(new Set([item.id]));
            } else if (selectionMode === "MULTIPLE") {
                const newSelection = new Set(selectedIds);
                if (newSelection.has(item.id)) {
                    newSelection.delete(item.id);
                } else {
                    newSelection.add(item.id);
                }
                setSelectedIds(newSelection);
            }
        }
    };

    const selectAll = () => {
        if (selectionMode === "MULTIPLE") {
            setSelectedIds(new Set(fruits.map((f) => f.id)));
        }
    };

    const selectNone = () => {
        if (selectionMode !== "BROWSE") {
            setSelectedIds(new Set());
        }
    };

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
                label="Demonstrates the four GTK selection modes: NONE (no selection), SINGLE (toggle one item), BROWSE (always one selected), and MULTIPLE (select many items)."
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
                        {selectionModes.map((mode) => (
                            <GtkButton
                                key={mode.mode}
                                label={mode.label}
                                onClicked={() => {
                                    setSelectionMode(mode.mode);
                                    if (mode.mode === "NONE") {
                                        setSelectedIds(new Set());
                                    } else if (mode.mode === "BROWSE" && selectedIds.size === 0) {
                                        setSelectedIds(new Set([fruits[0]?.id ?? ""]));
                                    } else if (mode.mode === "SINGLE" && selectedIds.size > 1) {
                                        const first = Array.from(selectedIds)[0];
                                        setSelectedIds(new Set(first ? [first] : []));
                                    }
                                }}
                                cssClasses={selectionMode === mode.mode ? ["suggested-action"] : ["flat"]}
                            />
                        ))}
                    </GtkBox>
                    <GtkLabel
                        label={selectionModes.find((m) => m.mode === selectionMode)?.description ?? ""}
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
                            sensitive={selectionMode === "MULTIPLE"}
                            cssClasses={["flat"]}
                        />
                        <GtkButton
                            label="Select None"
                            onClicked={selectNone}
                            sensitive={selectionMode !== "BROWSE" && selectionMode !== "NONE"}
                            cssClasses={["flat"]}
                        />
                        <GtkLabel
                            label={`${selectedIds.size} selected`}
                            cssClasses={["dim-label"]}
                            hexpand
                            halign={Gtk.Align.END}
                        />
                    </GtkBox>

                    <GtkScrolledWindow heightRequest={300} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                        <x.ListView<FruitItem>
                            estimatedItemHeight={48}
                            showSeparators
                            onActivate={handleActivate}
                            renderItem={(item) => (
                                <GtkBox
                                    spacing={12}
                                    marginTop={8}
                                    marginBottom={8}
                                    marginStart={12}
                                    marginEnd={12}
                                    cssClasses={selectedIds.has(item?.id ?? "") ? ["card"] : []}
                                >
                                    <GtkImage
                                        iconName={
                                            selectedIds.has(item?.id ?? "") ? "emblem-ok-symbolic" : (item?.icon ?? "")
                                        }
                                        pixelSize={24}
                                        cssClasses={selectedIds.has(item?.id ?? "") ? ["success"] : []}
                                    />
                                    <GtkLabel
                                        label={item?.name ?? ""}
                                        hexpand
                                        halign={Gtk.Align.START}
                                        cssClasses={selectedIds.has(item?.id ?? "") ? ["heading"] : []}
                                    />
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
                    {selectedIds.size === 0 ? (
                        <GtkLabel label="No items selected" cssClasses={["dim-label"]} halign={Gtk.Align.START} />
                    ) : (
                        <GtkBox spacing={8}>
                            {Array.from(selectedIds).map((id) => {
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
                <GtkLabel label="Selection Mode Reference" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="NONE: Items cannot be selected. SINGLE: Click to toggle selection of one item. BROWSE: One item is always selected; click to change. MULTIPLE: Select multiple items using Ctrl+click to toggle or Shift+click for range selection."
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
    title: "Selection Modes",
    description: "ListView demonstrating NONE, SINGLE, BROWSE, and MULTIPLE selection modes",
    keywords: ["listview", "selection", "GtkListView", "single", "multiple", "browse", "none"],
    component: ListViewSelectionsDemo,
    sourceCode,
};
