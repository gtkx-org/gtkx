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
} from "@gtkx/react";

import type { RefObject } from "react";
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
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
    { id: "8", value: 8, label: (8).toLocaleString("en-US") },
    { id: "64", value: 64, label: (64).toLocaleString("en-US") },
    { id: "512", value: 512, label: (512).toLocaleString("en-US") },
    { id: "4096", value: 4096, label: (4096).toLocaleString("en-US") },
    { id: "32768", value: 32768, label: (32768).toLocaleString("en-US") },
    { id: "262144", value: 262144, label: (262144).toLocaleString("en-US") },
    { id: "2097152", value: 2097152, label: (2097152).toLocaleString("en-US") },
    { id: "16777216", value: 16777216, label: (16777216).toLocaleString("en-US") },
];

let tnumAttrs: Pango.AttrList | undefined;
function getTnumAttrs() {
    if (!tnumAttrs) {
        tnumAttrs = Pango.AttrList.new();
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

function drawColorSwatch(
    cr: Context,
    { width, height, r, g, b }: { width: number; height: number; r: number; g: number; b: number },
): void {
    cr.setSourceRgb(r / 255, g / 255, b / 255);
    cr.rectangle(0, 0, width, height);
    cr.fill();
}

const ColorGridItem = memo(({ item, showDetails }: { item: ColorItem; showDetails: boolean }) => {
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
                    render={(cr, w, h) => drawColorSwatch(cr, { width: w, height: h, r: item.r, g: item.g, b: item.b })}
                />
                <GtkLabel
                    label={`<b>${item.name}</b>`}
                    useMarkup
                    cssClasses={["caption"]}
                    ellipsize={3}
                    maxWidthChars={10}
                />
                <GtkLabel
                    label={`<b>R:</b> ${item.r} <b>G:</b> ${item.g} <b>B:</b> ${item.b}`}
                    useMarkup
                    cssClasses={["dim-label", "caption", "monospace"]}
                />
                <GtkLabel
                    label={`<b>H:</b> ${item.h} <b>S:</b> ${item.s} <b>V:</b> ${item.v}`}
                    useMarkup
                    cssClasses={["dim-label", "caption", "monospace"]}
                />
            </GtkBox>
        );
    }

    return (
        <GtkDrawingArea
            contentWidth={32}
            contentHeight={32}
            render={(cr, w, h) => drawColorSwatch(cr, { width: w, height: h, r: item.r, g: item.g, b: item.b })}
        />
    );
});

const renderSelectionItem = (item: ColorItem) => (
    <GtkDrawingArea
        contentWidth={8}
        contentHeight={8}
        render={(cr, w, h) => {
            drawColorSwatch(cr, { width: w, height: h, r: item.r, g: item.g, b: item.b });
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
            <GtkGrid.Child column={0} row={0} columnSpan={5}>
                <GtkLabel label="Selection" hexpand cssClasses={TITLE_CSS} />
            </GtkGrid.Child>
            <GtkGrid.Child column={0} row={1} columnSpan={5}>
                <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
                    <GtkGridView
                        maxColumns={200}
                        cssClasses={SELECTION_GRID_CSS}
                        estimatedItemHeight={32}
                        renderItem={renderSelectionItem}
                        items={selectedColors.map((c) => ({ id: c.id, value: c }))}
                    />
                </GtkScrolledWindow>
            </GtkGrid.Child>
            <GtkGrid.Child column={0} row={2}>
                <GtkLabel label="Size:" />
            </GtkGrid.Child>
            <GtkGrid.Child column={1} row={2}>
                <GtkLabel label={String(selectedColors.length)} />
            </GtkGrid.Child>
            <GtkGrid.Child column={2} row={2}>
                <GtkLabel label="Average:" />
            </GtkGrid.Child>
            <GtkGrid.Child column={3} row={2}>
                <GtkDrawingArea
                    contentWidth={32}
                    contentHeight={32}
                    render={(cr, w, h) =>
                        drawColorSwatch(cr, {
                            width: w,
                            height: h,
                            r: averageColor.r,
                            g: averageColor.g,
                            b: averageColor.b,
                        })
                    }
                />
            </GtkGrid.Child>
            <GtkGrid.Child column={4} row={2}>
                <GtkLabel label="" hexpand />
            </GtkGrid.Child>
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

function copyDefined({
    src,
    dst,
    from,
    to,
    dstStart,
}: {
    src: ColorItem[];
    dst: ColorItem[];
    from: number;
    to: number;
    dstStart: number;
}): number {
    let k = dstStart;
    for (let i = from; i < to; i++) {
        const value = src[i];
        if (value !== undefined) dst[k++] = value;
    }
    return k;
}

interface MergeRange {
    arr: ColorItem[];
    tmp: ColorItem[];
    cmp: (a: ColorItem, b: ColorItem) => number;
    start: number;
    mid: number;
    end: number;
}

function mergeInterleave({ arr, tmp, cmp, start, mid, end }: MergeRange): { i: number; j: number; k: number } {
    let i = start;
    let j = mid;
    let k = start;
    while (i < mid && j < end) {
        const a = arr[i];
        const b = arr[j];
        if (a === undefined || b === undefined) break;
        if (cmp(a, b) <= 0) {
            tmp[k++] = a;
            i++;
        } else {
            tmp[k++] = b;
            j++;
        }
    }
    return { i, j, k };
}

function mergeRange({ arr, tmp, cmp, start, mid, end }: MergeRange): void {
    const { i, j, k } = mergeInterleave({ arr, tmp, cmp, start, mid, end });
    const afterLeftTail = copyDefined({ src: arr, dst: tmp, from: i, to: mid, dstStart: k });
    copyDefined({ src: arr, dst: tmp, from: j, to: end, dstStart: afterLeftTail });
    copyDefined({ src: tmp, dst: arr, from: start, to: end, dstStart: start });
}

function mergeSort({
    arr,
    cmp,
    start,
    end,
    tmp,
}: {
    arr: ColorItem[];
    cmp: (a: ColorItem, b: ColorItem) => number;
    start: number;
    end: number;
    tmp: ColorItem[];
}): void {
    if (end - start <= 1) return;
    const mid = (start + end) >>> 1;
    mergeSort({ arr, cmp, start, end: mid, tmp });
    mergeSort({ arr, cmp, start: mid, end, tmp });
    mergeRange({ arr, tmp, cmp, start, mid, end });
}

const MERGE_SORT_CHUNK = 65536;

interface IncrementalMergeSortArgs {
    arr: ColorItem[];
    cmp: (a: ColorItem, b: ColorItem) => number;
    ctx: { canceled: boolean };
    setSorted: (s: ColorItem[]) => void;
    setProgress: (p: number) => void;
}

const runIncrementalMergeSort = ({ arr, cmp, ctx, setSorted, setProgress }: IncrementalMergeSortArgs) => {
    const n = arr.length;
    const tmp = new Array<ColorItem>(n);
    let blockSize = 1;

    setProgress(0);
    setSorted(arr);

    const sortStep = () => {
        if (ctx.canceled) return;

        const passStart = blockSize;
        const passEnd = Math.min(blockSize * 2, n);

        for (let start = 0; start < n; start += passEnd) {
            const end = Math.min(start + passEnd, n);
            const mid = Math.min(start + passStart, end);
            mergeRange({ arr, tmp, cmp, start, mid, end });
        }

        blockSize = passEnd;

        const totalPasses = Math.ceil(Math.log2(n));
        const currentPass = Math.ceil(Math.log2(blockSize));
        setProgress(currentPass / totalPasses);
        setSorted([...arr]);

        if (blockSize < n) setTimeout(sortStep, 0);
    };

    setTimeout(sortStep, 0);
};

function useIncrementalSort(colors: ColorItem[], mode: SortMode): { sorted: ColorItem[]; progress: number } {
    const [sorted, setSorted] = useState<ColorItem[]>(colors);
    const [progress, setProgress] = useState(1);
    const sortingRef = useRef<{ canceled: boolean }>({ canceled: false });

    useEffect(() => {
        sortingRef.current.canceled = true;
        const ctx = { canceled: false };
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
            mergeSort({ arr, cmp, start: 0, end: n, tmp });
            setSorted(arr);
            setProgress(1);
            return;
        }

        runIncrementalMergeSort({ arr, cmp, ctx, setSorted, setProgress });

        return () => {
            ctx.canceled = true;
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
    const [refillToken, setRefillToken] = useState(0);

    // biome-ignore lint/correctness/useExhaustiveDependencies: refillToken is a re-trigger signal
    useEffect(() => {
        const widget = widgetRef.current;
        if (!widget) return;

        const accumulated: ColorItem[] = [];
        const increment = Math.max(1, Math.floor(limit / 4096));
        let pendingFlushId: ReturnType<typeof setTimeout> | null = null;
        let canceled = false;

        setColors([]);
        setFilling(true);

        const tickId = widget.addTickCallback(() => {
            if (canceled) return false;

            const newSize = Math.min(limit, accumulated.length + increment);
            for (let i = accumulated.length; i < newSize; i++) accumulated.push(createColorItem(i));

            const done = accumulated.length >= limit;

            if (pendingFlushId === null) {
                pendingFlushId = setTimeout(() => {
                    pendingFlushId = null;
                    if (canceled) return;
                    setColors([...accumulated]);
                    if (accumulated.length >= limit) setFilling(false);
                }, 0);
            }

            return !done;
        });

        return () => {
            canceled = true;
            widget.removeTickCallback(tickId);
            if (pendingFlushId !== null) {
                clearTimeout(pendingFlushId);
                pendingFlushId = null;
            }
        };
    }, [limit, refillToken, widgetRef]);

    const refill = useCallback(() => setRefillToken((token) => token + 1), []);

    return { colors, filling, refill };
}

function useColorsState() {
    const [colorLimit, setColorLimit] = useState<ColorLimit>(4096);
    const [sortMode, setSortMode] = useState<SortMode>("unsorted");
    const [displayFactory, setDisplayFactory] = useState<DisplayFactory>("colors");
    const [showSelectionInfo, setShowSelectionInfo] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const buttonRef = useRef<Gtk.Button | null>(null);
    return {
        colorLimit,
        setColorLimit,
        sortMode,
        setSortMode,
        displayFactory,
        setDisplayFactory,
        showSelectionInfo,
        setShowSelectionInfo,
        selected,
        setSelected,
        buttonRef,
    };
}

type ColorsState = ReturnType<typeof useColorsState>;

function useColorsData(state: ColorsState) {
    const { colorLimit, sortMode, displayFactory, selected, buttonRef } = state;
    const { colors: baseColors, filling, refill } = useGradualRefill(buttonRef, colorLimit);
    const { sorted: sortedColors, progress: sortProgress } = useIncrementalSort(baseColors, sortMode);
    const isSorting = sortProgress < 1 && sortMode !== "unsorted";

    const colorMap = useMemo(() => {
        const map = new Map<string, ColorItem>();
        for (const c of baseColors) map.set(c.id, c);
        return map;
    }, [baseColors]);

    const selectedColors = useMemo(
        () => selected.map((id) => colorMap.get(id)).filter((c): c is ColorItem => c !== undefined),
        [selected, colorMap],
    );

    const averageColor = useMemo(() => calculateAverageColor(selectedColors), [selectedColors]);
    const showDetails = displayFactory === "everything";
    const gridCssClasses = displayFactory === "colors" ? COMPACT_CSS_CLASSES : EMPTY_CSS_CLASSES;

    return {
        baseColors,
        sortedColors,
        sortProgress,
        filling,
        isSorting,
        selectedColors,
        averageColor,
        showDetails,
        gridCssClasses,
        refill,
    };
}

type ColorsData = ReturnType<typeof useColorsData>;

function useColorsHandlers(state: ColorsState, data: ColorsData) {
    const handleRefill = useCallback(() => {
        data.refill();
        state.setSelected([]);
    }, [data, state]);

    const handleLimitChange = useCallback(
        (id: string) => {
            const limit = COLOR_LIMITS.find((l) => l.id === id);
            if (limit) {
                state.setColorLimit(limit.value);
                state.setSelected([]);
            }
        },
        [state],
    );

    const renderGridItem = useCallback(
        (item: ColorItem) => <ColorGridItem item={item} showDetails={data.showDetails} />,
        [data.showDetails],
    );

    return { handleRefill, handleLimitChange, renderGridItem };
}

function useColorsComputed(state: ColorsState) {
    const colors = useColorsData(state);
    const handlers = useColorsHandlers(state, colors);
    return { ...colors, ...handlers };
}

type ColorsComputed = ReturnType<typeof useColorsComputed>;

interface ColorsContextValue {
    state: ColorsState;
    computed: ColorsComputed;
}

const ColorsContext = createContext<ColorsContextValue | null>(null);

const useColorsContext = (): ColorsContextValue => {
    const ctx = useContext(ColorsContext);
    if (!ctx) throw new Error("ColorsContext is missing");
    return ctx;
};

const ListViewColorsProvider = ({ children }: DemoProviderProps) => {
    const state = useColorsState();
    const computed = useColorsComputed(state);
    const value = useMemo<ColorsContextValue>(() => ({ state, computed }), [state, computed]);
    return <ColorsContext.Provider value={value}>{children}</ColorsContext.Provider>;
};

const ColorsHeader = () => {
    const { state, computed } = useColorsContext();
    return (
        <GtkHeaderBar name="header-bar">
            <GtkHeaderBar.PackStart>
                <GtkToggleButton
                    name="selection-toggle"
                    iconName="emblem-important-symbolic"
                    tooltipText="Show selection info"
                    active={state.showSelectionInfo}
                    onToggled={(btn) => state.setShowSelectionInfo(btn.getActive())}
                />
                <GtkButton ref={state.buttonRef} label="_Refill" useUnderline onClicked={computed.handleRefill} />
                <GtkLabel
                    label={`${computed.sortedColors.length.toLocaleString("en-US")} /`}
                    attributes={getTnumAttrs()}
                    widthChars={8}
                    xalign={1}
                />
                <GtkDropDown
                    name="limit-dropdown"
                    selectedId={String(state.colorLimit)}
                    onSelectionChanged={computed.handleLimitChange}
                    items={COLOR_LIMITS.map((l) => ({ id: l.id, value: l.label }))}
                />
            </GtkHeaderBar.PackStart>
            <GtkHeaderBar.PackEnd>
                <GtkBox spacing={10}>
                    <GtkLabel label="Sort by:" />
                    <GtkDropDown
                        name="sort-dropdown"
                        selectedId={state.sortMode}
                        onSelectionChanged={(id) => state.setSortMode(id as SortMode)}
                        items={SORT_MODES.map((m) => ({ id: m.id, value: m.label }))}
                    />
                </GtkBox>
                <GtkBox spacing={10}>
                    <GtkLabel label="Show:" />
                    <GtkDropDown
                        name="display-dropdown"
                        selectedId={state.displayFactory}
                        onSelectionChanged={(id) => state.setDisplayFactory(id as DisplayFactory)}
                        items={DISPLAY_FACTORIES.map((f) => ({ id: f.id, value: f.label }))}
                    />
                </GtkBox>
            </GtkHeaderBar.PackEnd>
        </GtkHeaderBar>
    );
};

const ColorsGridOverlay = ({ state, computed }: { state: ColorsState; computed: ColorsComputed }) => (
    <GtkOverlay name="grid-overlay" vexpand hexpand>
        <GtkScrolledWindow name="grid-scrolled" vexpand hexpand>
            <GtkGridView
                name="color-grid"
                estimatedItemHeight={computed.showDetails ? 120 : 40}
                minColumns={computed.showDetails ? 4 : 8}
                maxColumns={computed.showDetails ? 12 : 24}
                selectionMode={Gtk.SelectionMode.MULTIPLE}
                selected={state.selected}
                onSelectionChanged={state.setSelected}
                enableRubberband
                cssClasses={computed.gridCssClasses}
                renderItem={computed.renderGridItem}
                items={computed.sortedColors.map((color) => ({ id: color.id, value: color }))}
            />
        </GtkScrolledWindow>
        {(computed.isSorting || computed.filling) && computed.sortedColors.length > 0 && (
            <GtkOverlay.Child>
                <GtkProgressBar
                    fraction={Math.min(
                        1,
                        computed.filling ? computed.baseColors.length / state.colorLimit : computed.sortProgress,
                    )}
                    halign={Gtk.Align.FILL}
                    valign={Gtk.Align.START}
                />
            </GtkOverlay.Child>
        )}
    </GtkOverlay>
);

const ListViewColorsDemo = () => {
    const { state, computed } = useColorsContext();
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkRevealer name="selection-revealer" revealChild={state.showSelectionInfo}>
                <SelectionInfoPanel selectedColors={computed.selectedColors} averageColor={computed.averageColor} />
            </GtkRevealer>
            <ColorsGridOverlay state={state} computed={computed} />
        </GtkBox>
    );
};

export const listviewColorsDemo: Demo = {
    id: "listview-colors",
    title: "Lists/Colors",
    description:
        "This demo displays a grid of colors.\n\nIt is using a GtkGridView, and shows how to display and sort the data in various ways. The controls for this are implemented using GtkDropDown.\n\nThe dataset used here has up to 16 777 216 items.\n\nNote that this demo also functions as a performance test for some of the list model machinery, and the biggest sizes here can lock up the application for extended times when used with sorting.",
    keywords: ["GtkSortListModel", "GtkMultiSelection"],
    component: ListViewColorsDemo,
    titlebar: ColorsHeader,
    provider: ListViewColorsProvider,
    sourceCode,
    defaultWidth: 800,
    defaultHeight: 400,
};
