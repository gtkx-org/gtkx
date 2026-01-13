import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkScrolledWindow, GtkSearchEntry, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-colors.tsx?raw";

interface ColorItem {
    id: string;
    name: string;
    hex: string;
    rgb: string;
    category: string;
}

const colorPalette: ColorItem[] = [
    { id: "red-1", name: "Light Coral", hex: "#f66151", rgb: "246, 97, 81", category: "Red" },
    { id: "red-2", name: "Red", hex: "#e01b24", rgb: "224, 27, 36", category: "Red" },
    { id: "red-3", name: "Dark Red", hex: "#a51d2d", rgb: "165, 29, 45", category: "Red" },
    { id: "orange-1", name: "Light Orange", hex: "#ffbe6f", rgb: "255, 190, 111", category: "Orange" },
    { id: "orange-2", name: "Orange", hex: "#ff7800", rgb: "255, 120, 0", category: "Orange" },
    { id: "orange-3", name: "Dark Orange", hex: "#c64600", rgb: "198, 70, 0", category: "Orange" },
    { id: "yellow-1", name: "Light Yellow", hex: "#f9f06b", rgb: "249, 240, 107", category: "Yellow" },
    { id: "yellow-2", name: "Yellow", hex: "#f5c211", rgb: "245, 194, 17", category: "Yellow" },
    { id: "yellow-3", name: "Dark Yellow", hex: "#e5a50a", rgb: "229, 165, 10", category: "Yellow" },
    { id: "green-1", name: "Light Green", hex: "#8ff0a4", rgb: "143, 240, 164", category: "Green" },
    { id: "green-2", name: "Green", hex: "#33d17a", rgb: "51, 209, 122", category: "Green" },
    { id: "green-3", name: "Dark Green", hex: "#26a269", rgb: "38, 162, 105", category: "Green" },
    { id: "blue-1", name: "Light Blue", hex: "#99c1f1", rgb: "153, 193, 241", category: "Blue" },
    { id: "blue-2", name: "Blue", hex: "#3584e4", rgb: "53, 132, 228", category: "Blue" },
    { id: "blue-3", name: "Dark Blue", hex: "#1c71d8", rgb: "28, 113, 216", category: "Blue" },
    { id: "purple-1", name: "Light Purple", hex: "#dc8add", rgb: "220, 138, 221", category: "Purple" },
    { id: "purple-2", name: "Purple", hex: "#9141ac", rgb: "145, 65, 172", category: "Purple" },
    { id: "purple-3", name: "Dark Purple", hex: "#813d9c", rgb: "129, 61, 156", category: "Purple" },
    { id: "brown-1", name: "Light Brown", hex: "#cdab8f", rgb: "205, 171, 143", category: "Brown" },
    { id: "brown-2", name: "Brown", hex: "#986a44", rgb: "152, 106, 68", category: "Brown" },
    { id: "brown-3", name: "Dark Brown", hex: "#63452c", rgb: "99, 69, 44", category: "Brown" },
    { id: "gray-1", name: "Light Gray", hex: "#c0bfbc", rgb: "192, 191, 188", category: "Gray" },
    { id: "gray-2", name: "Gray", hex: "#9a9996", rgb: "154, 153, 150", category: "Gray" },
    { id: "gray-3", name: "Dark Gray", hex: "#5e5c64", rgb: "94, 92, 100", category: "Gray" },
];

const categories = ["All", "Red", "Orange", "Yellow", "Green", "Blue", "Purple", "Brown", "Gray"];

const ColorSwatch = ({ color, size = 48 }: { color: string; size?: number }) => {
    const swatchStyle = css`
 background-color: ${color};
 border-radius: 8px;
 min-width: ${size}px;
 min-height: ${size}px;
 `;

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            cssClasses={[swatchStyle, "card"]}
            widthRequest={size}
            heightRequest={size}
        />
    );
};

const ListViewColorsDemo = () => {
    const [searchText, setSearchText] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [selectedColor, setSelectedColor] = useState<ColorItem | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const filteredColors = colorPalette.filter((color) => {
        const matchesSearch =
            searchText === "" ||
            color.name.toLowerCase().includes(searchText.toLowerCase()) ||
            color.hex.toLowerCase().includes(searchText.toLowerCase());
        const matchesCategory = selectedCategory === "All" || color.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const handleActivate = (_list: Gtk.ListView, position: number) => {
        const color = filteredColors[position];
        if (color) {
            setSelectedColor(color);
        }
    };

    const copyToClipboard = (color: ColorItem) => {
        setCopiedId(color.id);
        setTimeout(() => setCopiedId(null), 2000);
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
            <GtkLabel label="Color Palette Browser" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="ListView displays items in a vertical list with custom rendering. This demo shows a color palette browser with search, filtering, and selection."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Color Palette">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkSearchEntry
                        text={searchText}
                        placeholderText="Search colors by name or hex..."
                        onSearchChanged={(entry) => setSearchText(entry.getText())}
                    />

                    <GtkScrolledWindow
                        hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                        vscrollbarPolicy={Gtk.PolicyType.NEVER}
                    >
                        <GtkBox spacing={4}>
                            {categories.map((cat) => (
                                <GtkButton
                                    key={cat}
                                    label={cat}
                                    onClicked={() => setSelectedCategory(cat)}
                                    cssClasses={selectedCategory === cat ? ["suggested-action"] : ["flat"]}
                                />
                            ))}
                        </GtkBox>
                    </GtkScrolledWindow>

                    <GtkLabel
                        label={`Showing ${filteredColors.length} colors`}
                        cssClasses={["dim-label"]}
                        halign={Gtk.Align.START}
                    />

                    <GtkScrolledWindow heightRequest={300} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                        <x.ListView<ColorItem>
                            estimatedItemHeight={64}
                            showSeparators
                            onActivate={handleActivate}
                            renderItem={(item) => (
                                <GtkBox spacing={16} marginTop={8} marginBottom={8} marginStart={12} marginEnd={12}>
                                    <ColorSwatch color={item?.hex ?? "#fff"} />
                                    <GtkBox
                                        orientation={Gtk.Orientation.VERTICAL}
                                        spacing={4}
                                        hexpand
                                        valign={Gtk.Align.CENTER}
                                    >
                                        <GtkLabel label={item?.name ?? ""} halign={Gtk.Align.START} />
                                        <GtkBox spacing={16}>
                                            <GtkLabel
                                                label={item?.hex ?? ""}
                                                cssClasses={["dim-label", "caption", "monospace"]}
                                            />
                                            <GtkLabel
                                                label={`rgb(${item?.rgb ?? ""})`}
                                                cssClasses={["dim-label", "caption", "monospace"]}
                                            />
                                        </GtkBox>
                                    </GtkBox>
                                    <GtkButton
                                        iconName={copiedId === item?.id ? "emblem-ok-symbolic" : "edit-copy-symbolic"}
                                        cssClasses={["flat", "circular"]}
                                        onClicked={() => item && copyToClipboard(item)}
                                        valign={Gtk.Align.CENTER}
                                        tooltipText="Copy hex value"
                                    />
                                </GtkBox>
                            )}
                        >
                            {filteredColors.map((color) => (
                                <x.ListItem key={color.id} id={color.id} value={color} />
                            ))}
                        </x.ListView>
                    </GtkScrolledWindow>

                    {selectedColor && (
                        <GtkBox
                            spacing={16}
                            cssClasses={["card"]}
                            marginTop={8}
                            marginBottom={8}
                            marginStart={12}
                            marginEnd={12}
                        >
                            <ColorSwatch color={selectedColor.hex} size={64} />
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                valign={Gtk.Align.CENTER}
                                hexpand
                            >
                                <GtkLabel
                                    label={selectedColor.name}
                                    halign={Gtk.Align.START}
                                    cssClasses={["heading"]}
                                />
                                <GtkLabel
                                    label={`Category: ${selectedColor.category}`}
                                    cssClasses={["dim-label"]}
                                    halign={Gtk.Align.START}
                                />
                                <GtkBox spacing={16}>
                                    <GtkLabel
                                        label={`HEX: ${selectedColor.hex}`}
                                        cssClasses={["monospace", "caption"]}
                                    />
                                    <GtkLabel
                                        label={`RGB: ${selectedColor.rgb}`}
                                        cssClasses={["monospace", "caption"]}
                                    />
                                </GtkBox>
                            </GtkBox>
                        </GtkBox>
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Key Properties" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="showSeparators: Display dividers between items. onActivate: Called when item is activated (double-click or Enter). renderItem: Function to render each list row. ListView is virtualized for efficient rendering of large lists."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const listviewColorsDemo: Demo = {
    id: "listview-colors",
    title: "Lists/Colors",
    description: "ListView showing a color palette browser with search and filtering",
    keywords: ["listview", "colors", "palette", "GtkListView", "search", "filter"],
    component: ListViewColorsDemo,
    sourceCode,
};
