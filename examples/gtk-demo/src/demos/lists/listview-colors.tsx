import { css } from "@gtkx/css";
import type { Context } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import {
    GtkBox,
    GtkButton,
    GtkDrawingArea,
    GtkDropDown,
    GtkGrid,
    GtkGridView,
    GtkHeaderBar,
    GtkLabel,
    GtkOverlay,
    GtkProgressBar,
    GtkRevealer,
    GtkScrolledWindow,
    GtkToggleButton,
    x,
} from "@gtkx/react";
import type { RefObject } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import colorNamesRaw from "./color.names.txt?raw";
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
type ColorLimit = 8 | 64 | 512 | 4096 | 32768 | 262144 | 2097152 | 16777216;

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
    { id: "8", value: 8, label: "8" },
    { id: "64", value: 64, label: "64" },
    { id: "512", value: 512, label: "512" },
    { id: "4096", value: 4096, label: "4096" },
    { id: "32768", value: 32768, label: "32,768" },
    { id: "262144", value: 262144, label: "262,144" },
    { id: "2097152", value: 2097152, label: "2,097,152" },
    { id: "16777216", value: 16777216, label: "16,777,216" },
];

let tnumAttrs: Pango.AttrList | undefined;
function getTnumAttrs() {
    if (!tnumAttrs) {
        tnumAttrs = new Pango.AttrList();
        tnumAttrs.insert(Pango.attrFontFeaturesNew("tnum"));
    }
    return tnumAttrs;
}

const POSITION_TO_COLOR_MAP = [
    0xff0000, 0x00ff00, 0x0000ff, 0x7f0000, 0x007f00, 0x00007f, 0x3f0000, 0x003f00, 0x00003f, 0x1f0000, 0x001f00,
    0x00001f, 0x0f0000, 0x000f00, 0x00000f, 0x070000, 0x000700, 0x000007, 0x030000, 0x000300, 0x000003, 0x010000,
    0x000100, 0x000001,
];

function positionToColor(position: number): number {
    let result = 0;
    for (let i = 0; i < POSITION_TO_COLOR_MAP.length; i++) {
        if (position & (1 << i)) result ^= POSITION_TO_COLOR_MAP[i] ?? 0;
    }
    return result;
}

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

const colorNameMap = new Map<number, string>();
for (const line of colorNamesRaw.split("\n")) {
    if (line.startsWith("#") || line.length === 0) continue;
    const fields = line.split(/\s+/);
    const name = fields[1];
    const r = Number.parseInt(fields[3] ?? "0", 10);
    const g = Number.parseInt(fields[4] ?? "0", 10);
    const b = Number.parseInt(fields[5] ?? "0", 10);
    if (name) {
        const key = ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
        if (!colorNameMap.has(key)) {
            colorNameMap.set(key, name);
        }
    }
}

function generateColorName(r: number, g: number, b: number): string {
    const key = ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
    return (
        colorNameMap.get(key) ??
        `#${componentToHex(r).toUpperCase()}${componentToHex(g).toUpperCase()}${componentToHex(b).toUpperCase()}`
    );
}

function createColorItem(position: number): ColorItem {
    const rgb = positionToColor(position);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = rgb & 0xff;
    const hex = rgbToHex(r, g, b);
    const hsv = rgbToHsv(r, g, b);

    return {
        id: `color-${position}`,
        name: generateColorName(r, g, b),
        hex,
        r,
        g,
        b,
        h: hsv.h,
        s: hsv.s,
        v: hsv.v,
    };
}

function calculateAverageColor(colors: ColorItem[]): { r: number; g: number; b: number; hex: string } {
    if (colors.length === 0) return { r: 128, g: 128, b: 128, hex: "#808080" };

    const sum = colors.reduce((acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }), { r: 0, g: 0, b: 0 });

    const r = Math.round(sum.r / colors.length);
    const g = Math.round(sum.g / colors.length);
    const b = Math.round(sum.b / colors.length);

    return { r, g, b, hex: rgbToHex(r, g, b) };
}

function drawColorSwatch(cr: Context, width: number, height: number, r: number, g: number, b: number): void {
    cr.setSourceRgb(r / 255, g / 255, b / 255);
    cr.rectangle(0, 0, width, height);
    cr.fill();
}

const ColorGridItem = memo(({ item, showDetails }: { item: ColorItem | null; showDetails: boolean }) => {
    if (!item) return null;

    if (showDetails) {
        return (
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={4}
                marginStart={2}
                marginEnd={2}
                marginTop={2}
                marginBottom={2}
                halign={Gtk.Align.CENTER}
            >
                <GtkDrawingArea
                    contentWidth={48}
                    contentHeight={48}
                    onDraw={(cr, w, h) => drawColorSwatch(cr, w, h, item.r, item.g, item.b)}
                />
                <GtkLabel
                    label={`<b>${item.name}</b>`}
                    useMarkup
                    cssClasses={["caption"]}
                    ellipsize={3}
                    maxWidthChars={10}
                />
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

    return (
        <GtkDrawingArea
            contentWidth={32}
            contentHeight={32}
            onDraw={(cr, w, h) => drawColorSwatch(cr, w, h, item.r, item.g, item.b)}
        />
    );
});

const renderSelectionItem = (item: ColorItem | null) => (
    <GtkDrawingArea
        contentWidth={8}
        contentHeight={8}
        onDraw={(cr, w, h) => {
            if (item) drawColorSwatch(cr, w, h, item.r, item.g, item.b);
        }}
    />
);

const SELECTION_GRID_CSS = ["compact"];
const TITLE_CSS = ["title-3"];

const SelectionInfoPanel = ({
    selectedColors,
    averageColor,
}: {
    selectedColors: ColorItem[];
    averageColor: { r: number; g: number; b: number; hex: string };
}) => {
    return (
        <GtkGrid marginStart={10} marginEnd={10} marginTop={10} marginBottom={10} rowSpacing={10} columnSpacing={10}>
            <x.GridChild column={0} row={0} columnSpan={5}>
                <GtkLabel label="Selection" hexpand cssClasses={TITLE_CSS} />
            </x.GridChild>
            <x.GridChild column={0} row={1} columnSpan={5}>
                <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
                    <GtkGridView
                        maxColumns={200}
                        cssClasses={SELECTION_GRID_CSS}
                        estimatedItemHeight={32}
                        renderItem={renderSelectionItem}
                    >
                        {selectedColors.map((c) => (
                            <x.ListItem key={c.id} id={c.id} value={c} />
                        ))}
                    </GtkGridView>
                </GtkScrolledWindow>
            </x.GridChild>
            <x.GridChild column={0} row={2}>
                <GtkLabel label="Size:" />
            </x.GridChild>
            <x.GridChild column={1} row={2}>
                <GtkLabel label={String(selectedColors.length)} />
            </x.GridChild>
            <x.GridChild column={2} row={2}>
                <GtkLabel label="Average:" />
            </x.GridChild>
            <x.GridChild column={3} row={2}>
                <GtkDrawingArea
                    contentWidth={32}
                    contentHeight={32}
                    onDraw={(cr, w, h) => drawColorSwatch(cr, w, h, averageColor.r, averageColor.g, averageColor.b)}
                />
            </x.GridChild>
            <x.GridChild column={4} row={2}>
                <GtkLabel label="" hexpand />
            </x.GridChild>
        </GtkGrid>
    );
};

const COMPACT_CSS_CLASSES = [css`&.view > child { padding: 1px; }`];
const EMPTY_CSS_CLASSES: string[] = [];

function getCompareFn(mode: SortMode): ((a: ColorItem, b: ColorItem) => number) | null {
    switch (mode) {
        case "unsorted":
            return null;
        case "name":
            return (a, b) => a.name.localeCompare(b.name);
        case "red":
            return (a, b) => b.r - a.r;
        case "green":
            return (a, b) => b.g - a.g;
        case "blue":
            return (a, b) => b.b - a.b;
        case "rgb":
            return (a, b) => b.r - a.r || b.g - a.g || b.b - a.b;
        case "hue":
            return (a, b) => b.h - a.h;
        case "saturation":
            return (a, b) => b.s - a.s;
        case "value":
            return (a, b) => b.v - a.v;
        case "hsv":
            return (a, b) => b.h - a.h || b.s - a.s || b.v - a.v;
        default:
            return null;
    }
}

function mergeSort(
    arr: ColorItem[],
    cmp: (a: ColorItem, b: ColorItem) => number,
    start: number,
    end: number,
    tmp: ColorItem[],
): void {
    if (end - start <= 1) return;
    const mid = (start + end) >>> 1;
    mergeSort(arr, cmp, start, mid, tmp);
    mergeSort(arr, cmp, mid, end, tmp);

    let i = start;
    let j = mid;
    let k = start;
    while (i < mid && j < end) {
        const a = arr[i] as ColorItem;
        const b = arr[j] as ColorItem;
        if (cmp(a, b) <= 0) {
            tmp[k++] = a;
            i++;
        } else {
            tmp[k++] = b;
            j++;
        }
    }
    while (i < mid) tmp[k++] = arr[i++] as ColorItem;
    while (j < end) tmp[k++] = arr[j++] as ColorItem;
    for (let idx = start; idx < end; idx++) {
        arr[idx] = tmp[idx] as ColorItem;
    }
}

const MERGE_SORT_CHUNK = 65536;

function useIncrementalSort(colors: ColorItem[], mode: SortMode): { sorted: ColorItem[]; progress: number } {
    const [sorted, setSorted] = useState<ColorItem[]>(colors);
    const [progress, setProgress] = useState(1);
    const sortingRef = useRef<{ cancelled: boolean }>({ cancelled: false });

    useEffect(() => {
        sortingRef.current.cancelled = true;
        const ctx = { cancelled: false };
        sortingRef.current = ctx;

        const cmp = getCompareFn(mode);
        if (!cmp) {
            setSorted(colors);
            setProgress(1);
            return;
        }

        const arr = [...colors];
        const n = arr.length;

        if (n <= MERGE_SORT_CHUNK) {
            const tmp = new Array<ColorItem>(n);
            mergeSort(arr, cmp, 0, n, tmp);
            setSorted(arr);
            setProgress(1);
            return;
        }

        const tmp = new Array<ColorItem>(n);
        let blockSize = 1;

        setProgress(0);
        setSorted(arr);

        const sortStep = () => {
            if (ctx.cancelled) return;

            const passStart = blockSize;
            const passEnd = Math.min(blockSize * 2, n);

            for (let start = 0; start < n; start += passEnd) {
                const end = Math.min(start + passEnd, n);
                const mid = Math.min(start + passStart, end);

                let i = start;
                let j = mid;
                let k = start;
                while (i < mid && j < end) {
                    const a = arr[i] as ColorItem;
                    const b = arr[j] as ColorItem;
                    if (cmp(a, b) <= 0) {
                        tmp[k++] = a;
                        i++;
                    } else {
                        tmp[k++] = b;
                        j++;
                    }
                }
                while (i < mid) tmp[k++] = arr[i++] as ColorItem;
                while (j < end) tmp[k++] = arr[j++] as ColorItem;
                for (let idx = start; idx < end; idx++) {
                    arr[idx] = tmp[idx] as ColorItem;
                }
            }

            blockSize = passEnd;

            const totalPasses = Math.ceil(Math.log2(n));
            const currentPass = Math.ceil(Math.log2(blockSize));
            setProgress(currentPass / totalPasses);
            setSorted([...arr]);

            if (blockSize < n) {
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

function useGradualRefill(
    widgetRef: RefObject<Gtk.Widget | null>,
    limit: ColorLimit,
): {
    colors: ColorItem[];
    filling: boolean;
    refill: () => void;
} {
    const [colors, setColors] = useState<ColorItem[]>([]);
    const [filling, setFilling] = useState(true);
    const tickIdRef = useRef<number | null>(null);
    const limitRef = useRef(limit);

    const stopTick = useCallback(() => {
        const widget = widgetRef.current;
        if (tickIdRef.current !== null && widget) {
            widget.removeTickCallback(tickIdRef.current);
            tickIdRef.current = null;
        }
    }, [widgetRef]);

    const startFill = useCallback(
        (targetLimit: number) => {
            stopTick();

            const widget = widgetRef.current;
            if (!widget) return;

            const accumulated: ColorItem[] = [];
            setColors([]);
            setFilling(true);

            const increment = Math.max(1, Math.floor(targetLimit / 4096));

            tickIdRef.current = widget.addTickCallback((): boolean => {
                const newSize = Math.min(targetLimit, accumulated.length + increment);
                for (let i = accumulated.length; i < newSize; i++) {
                    accumulated.push(createColorItem(i));
                }

                const snapshot = [...accumulated];
                const done = accumulated.length >= targetLimit;

                setTimeout(() => {
                    setColors(snapshot);
                    if (done) {
                        setFilling(false);
                    }
                }, 0);

                if (done) {
                    tickIdRef.current = null;
                    return false;
                }
                return true;
            });
        },
        [widgetRef, stopTick],
    );

    useEffect(() => {
        limitRef.current = limit;
        startFill(limit);
        return stopTick;
    }, [limit, startFill, stopTick]);

    const refill = useCallback(() => {
        startFill(limitRef.current);
    }, [startFill]);

    return { colors, filling, refill };
}

const ListViewColorsDemo = () => {
    const [colorLimit, setColorLimit] = useState<ColorLimit>(4096);
    const [sortMode, setSortMode] = useState<SortMode>("unsorted");
    const [displayFactory, setDisplayFactory] = useState<DisplayFactory>("colors");
    const [showSelectionInfo, setShowSelectionInfo] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const buttonRef = useRef<Gtk.Button | null>(null);

    const { colors: baseColors, filling, refill } = useGradualRefill(buttonRef, colorLimit);
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

    const handleRefill = useCallback(() => {
        refill();
        setSelected([]);
    }, [refill]);

    const handleLimitChange = useCallback((id: string) => {
        const limit = COLOR_LIMITS.find((l) => l.id === id);
        if (limit) {
            setColorLimit(limit.value);
            setSelected([]);
        }
    }, []);

    const showDetails = displayFactory === "everything";

    const renderGridItem = useCallback(
        (item: ColorItem | null) => <ColorGridItem item={item} showDetails={showDetails} />,
        [showDetails],
    );

    const gridCssClasses = displayFactory === "colors" ? COMPACT_CSS_CLASSES : EMPTY_CSS_CLASSES;

    return (
        <>
            <x.Slot for="GtkWindow" id="titlebar">
                <GtkHeaderBar>
                    <x.ContainerSlot for={GtkHeaderBar} id="packStart">
                        <GtkToggleButton
                            iconName="emblem-important-symbolic"
                            tooltipText="Show selection info"
                            active={showSelectionInfo}
                            onToggled={(btn) => setShowSelectionInfo(btn.getActive())}
                        />
                        <GtkButton ref={buttonRef} label="_Refill" useUnderline onClicked={handleRefill} />
                        <GtkLabel
                            label={`${sortedColors.length} /`}
                            attributes={getTnumAttrs()}
                            widthChars={8}
                            xalign={1}
                        />
                        <GtkDropDown selectedId={String(colorLimit)} onSelectionChanged={handleLimitChange}>
                            {COLOR_LIMITS.map((l) => (
                                <x.ListItem key={l.id} id={l.id} value={l.label} />
                            ))}
                        </GtkDropDown>
                    </x.ContainerSlot>
                    <x.ContainerSlot for={GtkHeaderBar} id="packEnd">
                        <GtkBox spacing={10}>
                            <GtkLabel label="Sort by:" />
                            <GtkDropDown selectedId={sortMode} onSelectionChanged={(id) => setSortMode(id as SortMode)}>
                                {SORT_MODES.map((m) => (
                                    <x.ListItem key={m.id} id={m.id} value={m.label} />
                                ))}
                            </GtkDropDown>
                        </GtkBox>
                        <GtkBox spacing={10}>
                            <GtkLabel label="Show:" />
                            <GtkDropDown
                                selectedId={displayFactory}
                                onSelectionChanged={(id) => setDisplayFactory(id as DisplayFactory)}
                            >
                                {DISPLAY_FACTORIES.map((f) => (
                                    <x.ListItem key={f.id} id={f.id} value={f.label} />
                                ))}
                            </GtkDropDown>
                        </GtkBox>
                    </x.ContainerSlot>
                </GtkHeaderBar>
            </x.Slot>

            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkRevealer revealChild={showSelectionInfo}>
                    <SelectionInfoPanel selectedColors={selectedColors} averageColor={averageColor} />
                </GtkRevealer>

                <GtkOverlay vexpand hexpand>
                    <GtkScrolledWindow vexpand hexpand>
                        <GtkGridView
                            estimatedItemHeight={showDetails ? 120 : 40}
                            minColumns={showDetails ? 4 : 8}
                            maxColumns={showDetails ? 12 : 24}
                            selectionMode={Gtk.SelectionMode.MULTIPLE}
                            selected={selected}
                            onSelectionChanged={setSelected}
                            enableRubberband
                            cssClasses={gridCssClasses}
                            renderItem={renderGridItem}
                        >
                            {sortedColors.map((color) => (
                                <x.ListItem key={color.id} id={color.id} value={color} />
                            ))}
                        </GtkGridView>
                    </GtkScrolledWindow>
                    {(isSorting || filling) && sortedColors.length > 0 && (
                        <x.OverlayChild>
                            <GtkProgressBar
                                fraction={filling ? baseColors.length / colorLimit : sortProgress}
                                halign={Gtk.Align.FILL}
                                valign={Gtk.Align.START}
                            />
                        </x.OverlayChild>
                    )}
                </GtkOverlay>
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
    defaultWidth: 600,
    defaultHeight: 400,
};
