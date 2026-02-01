import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkDropDown,
    GtkGridView,
    GtkHeaderBar,
    GtkLabel,
    GtkProgressBar,
    GtkRevealer,
    GtkScrolledWindow,
    x,
} from "@gtkx/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listview-colors.tsx?raw";

interface ColorItem {
    id: string;
    name: string;
    hex: string;
    r: number;
    g: number;
    b: number;
    h: number;
    s: number;
    v: number;
}

type SortMode = "unsorted" | "name" | "red" | "green" | "blue" | "rgb" | "hue" | "saturation" | "value" | "hsv";
type DisplayFactory = "colors" | "everything";
type ColorLimit = 512 | 1024 | 2048 | 4096;

const SORT_MODES: { id: SortMode; label: string }[] = [
    { id: "unsorted", label: "Unsorted" },
    { id: "name", label: "Name" },
    { id: "red", label: "Red" },
    { id: "green", label: "Green" },
    { id: "blue", label: "Blue" },
    { id: "rgb", label: "RGB" },
    { id: "hue", label: "Hue" },
    { id: "saturation", label: "Saturation" },
    { id: "value", label: "Value" },
    { id: "hsv", label: "HSV" },
];

const DISPLAY_FACTORIES: { id: DisplayFactory; label: string }[] = [
    { id: "colors", label: "Colors" },
    { id: "everything", label: "Everything" },
];

const COLOR_LIMITS: { id: string; value: ColorLimit; label: string }[] = [
    { id: "512", value: 512, label: "512" },
    { id: "1024", value: 1024, label: "1024" },
    { id: "2048", value: 2048, label: "2048" },
    { id: "4096", value: 4096, label: "4096" },
];

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
        if (max === rNorm) {
            h = 60 * (((gNorm - bNorm) / delta) % 6);
        } else if (max === gNorm) {
            h = 60 * ((bNorm - rNorm) / delta + 2);
        } else {
            h = 60 * ((rNorm - gNorm) / delta + 4);
        }
    }
    if (h < 0) h += 360;

    const s = max === 0 ? 0 : (delta / max) * 100;
    const v = max * 100;

    return { h: Math.round(h), s: Math.round(s), v: Math.round(v) };
}

function componentToHex(c: number): string {
    const hex = c.toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
}

function rgbToHex(r: number, g: number, b: number): string {
    return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

function generateColorName(r: number, g: number, b: number): string {
    return `#${componentToHex(r).toUpperCase()}${componentToHex(g).toUpperCase()}${componentToHex(b).toUpperCase()}`;
}

function seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        return state / 0x7fffffff;
    };
}

function generateColors(limit: ColorLimit, seed: number): ColorItem[] {
    const colors: ColorItem[] = [];
    const random = seededRandom(seed);

    for (let i = 0; i < limit; i++) {
        const r = Math.floor(random() * 256);
        const g = Math.floor(random() * 256);
        const b = Math.floor(random() * 256);
        const hex = rgbToHex(r, g, b);
        const hsv = rgbToHsv(r, g, b);

        colors.push({
            id: `color-${i}-${r}-${g}-${b}`,
            name: generateColorName(r, g, b),
            hex,
            r,
            g,
            b,
            h: hsv.h,
            s: hsv.s,
            v: hsv.v,
        });
    }

    return colors;
}

function calculateAverageColor(colors: ColorItem[]): { r: number; g: number; b: number; hex: string } {
    if (colors.length === 0) return { r: 128, g: 128, b: 128, hex: "#808080" };

    const sum = colors.reduce((acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }), { r: 0, g: 0, b: 0 });

    const r = Math.round(sum.r / colors.length);
    const g = Math.round(sum.g / colors.length);
    const b = Math.round(sum.b / colors.length);

    return { r, g, b, hex: rgbToHex(r, g, b) };
}

const colorSwatchStyle = (color: string, size: number) => css`
    background-color: ${color};
    min-width: ${size}px;
    min-height: ${size}px;
`;

const gridItemStyle = css`
    padding: 2px;
`;

const ColorGridItem = ({ item, showDetails }: { item: ColorItem | null; showDetails: boolean }) => {
    if (!item) return null;

    if (showDetails) {
        return (
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={4}
                cssClasses={[gridItemStyle]}
                halign={Gtk.Align.CENTER}
            >
                <GtkBox cssClasses={[colorSwatchStyle(item.hex, 48)]} />
                <GtkLabel label={item.name} cssClasses={["caption"]} ellipsize={3} maxWidthChars={10} />
                <GtkLabel
                    label={`${item.r}, ${item.g}, ${item.b}`}
                    cssClasses={["dim-label", "caption", "monospace"]}
                />
                <GtkLabel
                    label={`${item.h}° ${item.s}% ${item.v}%`}
                    cssClasses={["dim-label", "caption", "monospace"]}
                />
            </GtkBox>
        );
    }

    return <GtkBox cssClasses={[colorSwatchStyle(item.hex, 32)]} />;
};

const SelectionInfoPanel = ({
    selectedColors,
    averageColor,
}: {
    selectedColors: ColorItem[];
    averageColor: { r: number; g: number; b: number; hex: string };
}) => {
    const miniSwatchStyle = (color: string) => css`
        background-color: ${color};
        min-width: 8px;
        min-height: 8px;
    `;

    const averageSwatchStyle = css`
        background-color: ${averageColor.hex};
        min-width: 32px;
        min-height: 32px;
        border-radius: 4px;
    `;

    return (
        <GtkBox spacing={12} marginStart={12} marginEnd={12} marginTop={8} marginBottom={8} valign={Gtk.Align.CENTER}>
            <GtkBox spacing={2} cssClasses={["card"]} marginStart={4} marginEnd={4} marginTop={4} marginBottom={4}>
                {selectedColors.slice(0, 64).map((c) => (
                    <GtkBox key={c.id} cssClasses={[miniSwatchStyle(c.hex)]} />
                ))}
                {selectedColors.length > 64 && (
                    <GtkLabel label={`+${selectedColors.length - 64}`} cssClasses={["dim-label", "caption"]} />
                )}
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={2} valign={Gtk.Align.CENTER}>
                <GtkLabel label={`${selectedColors.length} selected`} cssClasses={["dim-label"]} />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={2} valign={Gtk.Align.CENTER}>
                <GtkBox cssClasses={[averageSwatchStyle]} />
                <GtkLabel label="Average" cssClasses={["dim-label", "caption"]} />
            </GtkBox>
        </GtkBox>
    );
};

const SORT_CHUNK_SIZE = 64;

function useIncrementalSort(colors: ColorItem[], mode: SortMode): { sorted: ColorItem[]; progress: number } {
    const [sorted, setSorted] = useState<ColorItem[]>(colors);
    const [progress, setProgress] = useState(1);
    const sortingRef = useRef<{ cancelled: boolean }>({ cancelled: false });

    useEffect(() => {
        sortingRef.current.cancelled = true;
        const ctx = { cancelled: false };
        sortingRef.current = ctx;

        if (mode === "unsorted") {
            setSorted(colors);
            setProgress(1);
            return;
        }

        const compareFn = (a: ColorItem, b: ColorItem): number => {
            switch (mode) {
                case "name":
                    return a.name.localeCompare(b.name);
                case "red":
                    return a.r - b.r;
                case "green":
                    return a.g - b.g;
                case "blue":
                    return a.b - b.b;
                case "rgb":
                    return a.r - b.r || a.g - b.g || a.b - b.b;
                case "hue":
                    return a.h - b.h;
                case "saturation":
                    return a.s - b.s;
                case "value":
                    return a.v - b.v;
                case "hsv":
                    return a.h - b.h || a.s - b.s || a.v - b.v;
                default:
                    return 0;
            }
        };

        const arr = [...colors];
        const n = arr.length;
        let sortedCount = 0;

        setProgress(0);
        setSorted(arr);

        const sortStep = () => {
            if (ctx.cancelled) return;

            const end = Math.min(sortedCount + SORT_CHUNK_SIZE, n);
            for (let i = sortedCount; i < end; i++) {
                let minIdx = i;
                for (let j = i + 1; j < n; j++) {
                    const itemJ = arr[j];
                    const itemMin = arr[minIdx];
                    if (itemJ && itemMin && compareFn(itemJ, itemMin) < 0) {
                        minIdx = j;
                    }
                }
                if (minIdx !== i) {
                    const tmp = arr[i];
                    const minItem = arr[minIdx];
                    if (tmp !== undefined && minItem !== undefined) {
                        arr[i] = minItem;
                        arr[minIdx] = tmp;
                    }
                }
            }
            sortedCount = end;

            const currentProgress = sortedCount / n;
            setProgress(currentProgress);
            setSorted([...arr]);

            if (sortedCount < n) {
                setTimeout(sortStep, 0);
            }
        };

        setTimeout(sortStep, 0);

        return () => {
            ctx.cancelled = true;
        };
    }, [colors, mode]);

    return { sorted, progress };
}

const ListViewColorsDemo = () => {
    const [colorLimit, setColorLimit] = useState<ColorLimit>(512);
    const [sortMode, setSortMode] = useState<SortMode>("unsorted");
    const [displayFactory, setDisplayFactory] = useState<DisplayFactory>("colors");
    const [showSelectionInfo, setShowSelectionInfo] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [colorSeed, setColorSeed] = useState(0);

    const baseColors = useMemo(() => generateColors(colorLimit, colorSeed), [colorLimit, colorSeed]);
    const { sorted: sortedColors, progress: sortProgress } = useIncrementalSort(baseColors, sortMode);
    const isSorting = sortProgress < 1 && sortMode !== "unsorted";

    const colorMap = useMemo(() => {
        const map = new Map<string, ColorItem>();
        for (const c of baseColors) {
            map.set(c.id, c);
        }
        return map;
    }, [baseColors]);

    const selectedColors = useMemo(() => {
        return selected.map((id) => colorMap.get(id)).filter((c): c is ColorItem => c !== undefined);
    }, [selected, colorMap]);

    const averageColor = useMemo(() => calculateAverageColor(selectedColors), [selectedColors]);

    const handleRefill = () => {
        setColorSeed((s) => s + 1);
        setSelected([]);
    };

    const handleLimitChange = (id: string) => {
        const limit = COLOR_LIMITS.find((l) => l.id === id);
        if (limit) {
            setColorLimit(limit.value);
            setSelected([]);
        }
    };

    return (
        <>
            <x.Slot for="GtkWindow" id="titlebar">
                <GtkHeaderBar>
                    <x.ContainerSlot for={GtkHeaderBar} id="packStart">
                        <GtkButton
                            iconName="view-refresh-symbolic"
                            tooltipText="Refill colors"
                            onClicked={handleRefill}
                        />
                        <GtkButton
                            iconName={showSelectionInfo ? "go-up-symbolic" : "go-down-symbolic"}
                            tooltipText={showSelectionInfo ? "Hide selection info" : "Show selection info"}
                            onClicked={() => setShowSelectionInfo(!showSelectionInfo)}
                            cssClasses={showSelectionInfo ? ["suggested-action"] : []}
                        />
                    </x.ContainerSlot>
                    <x.Slot for={GtkHeaderBar} id="titleWidget">
                        <GtkLabel label={`${selected.length} / ${sortedColors.length}`} />
                    </x.Slot>
                    <x.ContainerSlot for={GtkHeaderBar} id="packEnd">
                        <GtkDropDown
                            selectedId={displayFactory}
                            onSelectionChanged={(id) => setDisplayFactory(id as DisplayFactory)}
                            tooltipText="Display style"
                        >
                            {DISPLAY_FACTORIES.map((f) => (
                                <x.ListItem key={f.id} id={f.id} value={f.label} />
                            ))}
                        </GtkDropDown>
                        <GtkDropDown
                            selectedId={sortMode}
                            onSelectionChanged={(id) => setSortMode(id as SortMode)}
                            tooltipText="Sort order"
                        >
                            {SORT_MODES.map((m) => (
                                <x.ListItem key={m.id} id={m.id} value={m.label} />
                            ))}
                        </GtkDropDown>
                        <GtkDropDown
                            selectedId={String(colorLimit)}
                            onSelectionChanged={handleLimitChange}
                            tooltipText="Number of colors"
                        >
                            {COLOR_LIMITS.map((l) => (
                                <x.ListItem key={l.id} id={l.id} value={l.label} />
                            ))}
                        </GtkDropDown>
                    </x.ContainerSlot>
                </GtkHeaderBar>
            </x.Slot>

            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkRevealer revealChild={isSorting} transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}>
                    <GtkProgressBar fraction={sortProgress} />
                </GtkRevealer>

                <GtkRevealer revealChild={showSelectionInfo && selected.length > 0}>
                    <SelectionInfoPanel selectedColors={selectedColors} averageColor={averageColor} />
                </GtkRevealer>

                <GtkScrolledWindow vexpand hexpand>
                    <GtkGridView
                        estimatedItemHeight={displayFactory === "everything" ? 120 : 40}
                        minColumns={displayFactory === "everything" ? 4 : 8}
                        maxColumns={displayFactory === "everything" ? 12 : 24}
                        selectionMode={Gtk.SelectionMode.MULTIPLE}
                        selected={selected}
                        onSelectionChanged={setSelected}
                        enableRubberband
                        renderItem={(item) => (
                            <ColorGridItem item={item} showDetails={displayFactory === "everything"} />
                        )}
                    >
                        {sortedColors.map((color) => (
                            <x.ListItem key={color.id} id={color.id} value={color} />
                        ))}
                    </GtkGridView>
                </GtkScrolledWindow>
            </GtkBox>
        </>
    );
};

export const listviewColorsDemo: Demo = {
    id: "listview-colors",
    title: "Lists/Colors",
    description: "GridView showing generated colors with multi-selection, sorting, and various display styles",
    keywords: ["gridview", "colors", "palette", "GtkGridView", "selection", "sort", "multi-select"],
    component: ListViewColorsDemo,
    sourceCode,
};
