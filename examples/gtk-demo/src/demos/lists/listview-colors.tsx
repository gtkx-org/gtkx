import { css } from "@gtkx/css";
import { registerClass } from "@gtkx/ffi";
import type { Context } from "@gtkx/gi/cairo";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import {
    GtkBox,
    GtkButton,
    GtkDrawingArea,
    GtkDropDown,
    GtkGrid,
    GtkGridChild,
    GtkGridView,
    GtkHeaderBar,
    GtkLabel,
    GtkOverlay,
    GtkOverlayChild,
    GtkProgressBar,
    GtkRevealer,
    GtkScrolledWindow,
    GtkToggleButton,
} from "@gtkx/react";

import { createContext, memo, useContext, useEffect, useRef, useState } from "react";
import { useLatest } from "../../use-latest.js";
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

const PLACEHOLDER_COLOR_ITEM: ColorItem = createColorItem(0);

class ColorObject extends GObject.Object {
    colorItem: ColorItem = PLACEHOLDER_COLOR_ITEM;
}
registerClass(ColorObject, { gtypeName: "GtkxDemoColorObject" });

function createColorObject(position: number): ColorObject {
    const obj = new ColorObject();
    obj.colorItem = createColorItem(position);
    return obj;
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
            <GtkGridChild column={0} row={0} columnSpan={5}>
                <GtkLabel label="Selection" hexpand cssClasses={TITLE_CSS} />
            </GtkGridChild>
            <GtkGridChild column={0} row={1} columnSpan={5}>
                <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
                    <GtkGridView
                        maxColumns={200}
                        cssClasses={SELECTION_GRID_CSS}
                        estimatedItemHeight={32}
                        renderItem={renderSelectionItem}
                        items={selectedColors.map((c) => ({ id: c.id, value: c }))}
                    />
                </GtkScrolledWindow>
            </GtkGridChild>
            <GtkGridChild column={0} row={2}>
                <GtkLabel label="Size:" />
            </GtkGridChild>
            <GtkGridChild column={1} row={2}>
                <GtkLabel label={String(selectedColors.length)} />
            </GtkGridChild>
            <GtkGridChild column={2} row={2}>
                <GtkLabel label="Average:" />
            </GtkGridChild>
            <GtkGridChild column={3} row={2}>
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
            </GtkGridChild>
            <GtkGridChild column={4} row={2}>
                <GtkLabel label="" hexpand />
            </GtkGridChild>
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

interface ColorsModels {
    baseStore: Gio.ListStore;
    selection: Gtk.MultiSelection;
    /**
     * The demo's sort-state: an ordered array of every {@link ColorObject}
     * currently in {@link baseStore}, kept in lockstep with it. {@link reorderStore}
     * sorts this array by the active sort mode and splices the new order back
     * into {@link baseStore} in one pass, so the visible list reflects the
     * chosen ordering without rebuilding the items.
     */
    liveRefs: ColorObject[];
}

function useColorsModels(): ColorsModels {
    const ref = useRef<ColorsModels | null>(null);
    if (ref.current === null) {
        const baseStore = Gio.ListStore.new(ColorObject.prototype.__gtype__);
        const selection = new Gtk.MultiSelection({ model: baseStore });
        ref.current = { baseStore, selection, liveRefs: [] };
    }
    return ref.current;
}

function reorderStore(models: ColorsModels, mode: SortMode): void {
    const cmp = getCompareFn(mode);
    if (!cmp) return;
    if (models.liveRefs.length <= 1) return;
    models.liveRefs.sort((a, b) => cmp(a.colorItem, b.colorItem));
    models.baseStore.splice(0, models.baseStore.getNItems(), models.liveRefs);
}

function useColorsSortMode(models: ColorsModels, mode: SortMode): void {
    useEffect(() => {
        reorderStore(models, mode);
    }, [models, mode]);
}

const FILL_BATCH_DIVISOR = 4096;
const FILL_BATCH_MAX = 4096;

function fillSynchronously(models: ColorsModels, colorLimit: ColorLimit, sortMode: SortMode): void {
    models.baseStore.removeAll();
    models.liveRefs.length = 0;
    const batch: ColorObject[] = new Array(colorLimit);
    for (let i = 0; i < colorLimit; i++) batch[i] = createColorObject(i);
    for (const obj of batch) models.liveRefs.push(obj);
    models.baseStore.splice(0, 0, batch);
    reorderStore(models, sortMode);
}

function useColorsInitialFill(
    models: ColorsModels,
    colorLimit: ColorLimit,
    sortModeRef: React.RefObject<SortMode>,
): void {
    const filledRef = useRef(false);
    if (!filledRef.current) {
        filledRef.current = true;
        fillSynchronously(models, colorLimit, sortModeRef.current);
    }
}

function useColorsRefill(
    models: ColorsModels,
    gridView: Gtk.GridView | null,
    colorLimit: ColorLimit,
    sortModeRef: React.RefObject<SortMode>,
    refillToken: number,
): void {
    useEffect(() => {
        if (!gridView || refillToken === 0) return;
        models.baseStore.removeAll();
        models.liveRefs.length = 0;
        const increment = Math.min(FILL_BATCH_MAX, Math.max(1, Math.floor(colorLimit / FILL_BATCH_DIVISOR)));
        let appended = 0;
        const tickId = gridView.addTickCallback(() => {
            if (appended >= colorLimit) return false;
            const next = Math.min(colorLimit, appended + increment);
            const batch: ColorObject[] = new Array(next - appended);
            for (let i = appended, j = 0; i < next; i++, j++) batch[j] = createColorObject(i);
            for (const obj of batch) models.liveRefs.push(obj);
            models.baseStore.splice(models.baseStore.getNItems(), 0, batch);
            appended = next;
            if (appended >= colorLimit) {
                reorderStore(models, sortModeRef.current);
                return false;
            }
            return true;
        });
        return () => {
            gridView.removeTickCallback(tickId);
        };
    }, [models, gridView, colorLimit, sortModeRef, refillToken]);
}

function useColorsLimitFill(
    models: ColorsModels,
    colorLimit: ColorLimit,
    sortModeRef: React.RefObject<SortMode>,
): void {
    const previousLimitRef = useRef(colorLimit);
    useEffect(() => {
        if (previousLimitRef.current === colorLimit) return;
        previousLimitRef.current = colorLimit;
        fillSynchronously(models, colorLimit, sortModeRef.current);
    }, [models, colorLimit, sortModeRef]);
}

const formatItemCount = (count: number): string => `${count.toLocaleString("en-US")} /`;

/**
 * Mirrors the store's live item count into the header label without React
 * state, so the batched tick-callback fill does not re-render the tree on
 * every `items-changed`.
 */
function useStoreCountLabel(baseStore: Gio.ListStore, labelRef: React.RefObject<Gtk.Label | null>): void {
    useEffect(() => {
        const update = () => {
            labelRef.current?.setLabel(formatItemCount(baseStore.getNItems()));
        };
        update();
        baseStore.on("items-changed", update);
        return () => {
            baseStore.off("items-changed", update);
        };
    }, [baseStore, labelRef]);
}

/**
 * Drives the overlay progress bar's fraction and visibility imperatively
 * from the store's item count, again avoiding a per-tick re-render.
 */
function useStoreProgressBar(
    baseStore: Gio.ListStore,
    colorLimit: ColorLimit,
    progressBarRef: React.RefObject<Gtk.ProgressBar | null>,
): void {
    useEffect(() => {
        const update = () => {
            const bar = progressBarRef.current;
            if (!bar) return;
            const itemCount = baseStore.getNItems();
            bar.setFraction(Math.min(1, itemCount / colorLimit));
            bar.setVisible(itemCount > 0 && itemCount < colorLimit);
        };
        update();
        baseStore.on("items-changed", update);
        return () => {
            baseStore.off("items-changed", update);
        };
    }, [baseStore, colorLimit, progressBarRef]);
}

function collectSelectedColors(selection: Gtk.MultiSelection): ColorItem[] {
    const bitset = selection.getSelection();
    const size = bitset.getSize();
    const out: ColorItem[] = new Array(size);
    for (let i = 0; i < size; i++) {
        const position = bitset.getNth(i);
        const obj = selection.getItem(position) as ColorObject | null;
        if (obj) out[i] = obj.colorItem;
    }
    return out;
}

function useSelectedColors(selection: Gtk.MultiSelection): ColorItem[] {
    const [selectedColors, setSelectedColors] = useState<ColorItem[]>([]);

    useEffect(() => {
        const update = () => setSelectedColors(collectSelectedColors(selection));
        selection.on("selection-changed", update);
        update();
        return () => {
            selection.off("selection-changed", update);
        };
    }, [selection]);

    return selectedColors;
}

function useColorsState() {
    const [colorLimit, setColorLimit] = useState<ColorLimit>(4096);
    const [sortMode, setSortMode] = useState<SortMode>("unsorted");
    const [displayFactory, setDisplayFactory] = useState<DisplayFactory>("colors");
    const [showSelectionInfo, setShowSelectionInfo] = useState(false);
    const [refillToken, setRefillToken] = useState(0);
    return {
        colorLimit,
        setColorLimit,
        sortMode,
        setSortMode,
        displayFactory,
        setDisplayFactory,
        showSelectionInfo,
        setShowSelectionInfo,
        refillToken,
        bumpRefillToken: () => setRefillToken((t) => t + 1),
    };
}

type ColorsState = ReturnType<typeof useColorsState>;

function useColorsComputed(state: ColorsState, models: ColorsModels) {
    const { displayFactory, bumpRefillToken } = state;
    const selectedColors = useSelectedColors(models.selection);
    const averageColor = calculateAverageColor(selectedColors);
    const showDetails = displayFactory === "everything";
    const gridCssClasses = displayFactory === "colors" ? COMPACT_CSS_CLASSES : EMPTY_CSS_CLASSES;

    const handleRefill = () => {
        models.selection.unselectAll();
        bumpRefillToken();
    };

    const handleLimitChange = (id: string) => {
        const limit = COLOR_LIMITS.find((l) => l.id === id);
        if (limit) {
            models.selection.unselectAll();
            state.setColorLimit(limit.value);
        }
    };

    const renderGridItem = (obj: GObject.Object) => (
        <ColorGridItem item={(obj as ColorObject).colorItem} showDetails={showDetails} />
    );

    return {
        selectedColors,
        averageColor,
        showDetails,
        gridCssClasses,
        handleRefill,
        handleLimitChange,
        renderGridItem,
    };
}

type ColorsComputed = ReturnType<typeof useColorsComputed>;

interface ColorsContextValue {
    state: ColorsState;
    models: ColorsModels;
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
    const models = useColorsModels();
    useColorsSortMode(models, state.sortMode);
    const computed = useColorsComputed(state, models);
    const value = {
        state,
        models,
        computed,
    };
    return <ColorsContext.Provider value={value}>{children}</ColorsContext.Provider>;
};

const ColorsHeader = () => {
    const { state, models, computed } = useColorsContext();
    const countLabelRef = useRef<Gtk.Label | null>(null);
    useStoreCountLabel(models.baseStore, countLabelRef);
    return (
        <GtkHeaderBar
            name="header-bar"
            packStart={
                <>
                    <GtkToggleButton
                        name="selection-toggle"
                        iconName="emblem-important-symbolic"
                        tooltipText="Show selection info"
                        active={state.showSelectionInfo}
                        onToggled={(btn) => state.setShowSelectionInfo(btn.getActive())}
                    />
                    <GtkButton label="_Refill" useUnderline onClicked={computed.handleRefill} />
                    <GtkLabel
                        ref={countLabelRef}
                        label={formatItemCount(models.baseStore.getNItems())}
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
                </>
            }
            packEnd={
                <>
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
                </>
            }
        />
    );
};

const ColorsGridOverlay = () => {
    const { state, models, computed } = useColorsContext();
    const [gridView, setGridView] = useState<Gtk.GridView | null>(null);
    const progressBarRef = useRef<Gtk.ProgressBar | null>(null);
    const sortModeRef = useLatest(state.sortMode);
    useColorsInitialFill(models, state.colorLimit, sortModeRef);
    useColorsLimitFill(models, state.colorLimit, sortModeRef);
    useColorsRefill(models, gridView, state.colorLimit, sortModeRef, state.refillToken);
    useStoreProgressBar(models.baseStore, state.colorLimit, progressBarRef);

    return (
        <GtkOverlay name="grid-overlay" vexpand hexpand>
            <GtkScrolledWindow name="grid-scrolled" vexpand hexpand>
                <GtkGridView<ColorObject>
                    ref={setGridView}
                    name="color-grid"
                    estimatedItemHeight={computed.showDetails ? 120 : 40}
                    minColumns={computed.showDetails ? 4 : 8}
                    maxColumns={computed.showDetails ? 12 : 24}
                    enableRubberband
                    cssClasses={computed.gridCssClasses}
                    model={models.selection}
                    renderItem={computed.renderGridItem}
                />
            </GtkScrolledWindow>
            <GtkOverlayChild>
                <GtkProgressBar ref={progressBarRef} visible={false} halign={Gtk.Align.FILL} valign={Gtk.Align.START} />
            </GtkOverlayChild>
        </GtkOverlay>
    );
};

const ListViewColorsDemo = () => {
    const { state, computed } = useColorsContext();
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkRevealer name="selection-revealer" revealChild={state.showSelectionInfo}>
                <SelectionInfoPanel selectedColors={computed.selectedColors} averageColor={computed.averageColor} />
            </GtkRevealer>
            <ColorsGridOverlay />
        </GtkBox>
    );
};

export const listviewColorsDemo: Demo = {
    id: "listview-colors",
    title: "Lists/Colors",
    description:
        "This demo displays a grid of colors.\n\nIt is using a GtkGridView, and shows how to display and sort the data in various ways. The controls for this are implemented using GtkDropDown.\n\nThe dataset used here has up to 16 777 216 items.\n\nNote that this demo also functions as a performance test for some of the list model machinery, and the biggest sizes here can lock up the application for extended times when used with sorting.",
    keywords: ["GtkMultiSelection"],
    component: ListViewColorsDemo,
    titlebar: ColorsHeader,
    provider: ListViewColorsProvider,
    sourceCode,
    defaultWidth: 800,
    defaultHeight: 400,
};
