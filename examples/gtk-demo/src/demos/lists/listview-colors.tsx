import type { Context } from "@gtkx/cairo";
import type { GListStoreProps } from "@gtkx/jsx/gio";
import { DropDown, GridView, ListItemFactory, type ListItemRenderer } from "@gtkx/components";
import { css } from "@gtkx/css";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import {
    GtkBox,
    GtkButton,
    GtkCustomSorter,
    GtkDrawingArea,
    GtkGrid,
    GtkGridLayoutChild,
    GtkGridView,
    GtkHeaderBar,
    GtkLabel,
    GtkMultiSelection,
    GtkOverlay,
    GtkOverlayLayoutChild,
    GtkProgressBar,
    GtkRevealer,
    GtkScrolledWindow,
    GtkSortListModel,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { createElementComponent, createPortal, rootElement, useSignal } from "@gtkx/react";
import { registerClass } from "@gtkx/runtime";
import {
    createContext,
    type ReactNode,
    useContext,
    useEffect,
    useEffectEvent,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import colorNamesRaw from "./color.names.txt?raw";
import sourceCode from "./listview-colors.tsx?raw";

type SourceResult = typeof GLib.SOURCE_CONTINUE | typeof GLib.SOURCE_REMOVE;

type ColorItem = {
    id: string;
    name: string;
    hex: string;
    r: number;
    g: number;
    b: number;
    h: number;
    s: number;
    v: number;
};

type SortMode = "unsorted" | "name" | "red" | "green" | "blue" | "rgb" | "hue" | "saturation" | "value" | "hsv";
type DisplayFactory = "colors" | "everything";
type ColorLimit = 8 | 64 | 512 | 4096 | 32_768 | 262_144 | 2_097_152 | 16_777_216;
type ColorObject = InstanceType<typeof ColorObject>;

type NormalizedRgb = {
    r: number;
    g: number;
    b: number;
};

type Hsv = {
    h: number;
    s: number;
    v: number;
};

type AverageColor = {
    r: number;
    g: number;
    b: number;
    hex: string;
};

type SwatchGeometry = {
    width: number;
    height: number;
    r: number;
    g: number;
    b: number;
};

type ColorList = InstanceType<typeof ColorList>;

type ColorsModels = {
    colors: ColorList;
    sorter: Gtk.CustomSorter;
    sortModel: Gtk.SortListModel;
    selection: Gtk.MultiSelection;
};

type FillProgress = {
    models: ColorsModels;
    colorLimit: ColorLimit;
    increment: number;
    appended: number;
    onComplete: () => void;
};

type ColorsRefillOptions = {
    models: ColorsModels;
    gridView: Gtk.GridView | null;
    colorLimit: ColorLimit;
    sortMode: SortMode;
    refillToken: number;
};

type SelectionInfoPanelProps = {
    selectedColors: ColorItem[];
    averageColor: AverageColor;
};

type ColorsProgressBarProps = {
    model: Gio.ListModel;
    colorLimit: ColorLimit;
};

type ColorsState = ReturnType<typeof useColorsState>;
type ColorsComputed = ReturnType<typeof useColorsComputed>;

type ColorsContextValue = {
    state: ColorsState;
    models: ColorsModels;
    computed: ColorsComputed;
};

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
    { id: "32768", value: 32_768, label: (32_768).toLocaleString("en-US") },
    { id: "262144", value: 262_144, label: (262_144).toLocaleString("en-US") },
    { id: "2097152", value: 2_097_152, label: (2_097_152).toLocaleString("en-US") },
    { id: "16777216", value: 16_777_216, label: (16_777_216).toLocaleString("en-US") },
];

const POSITION_TO_COLOR_MAP = [
    0xFF_00_00, 0x00_FF_00, 0x00_00_FF, 0x7F_00_00, 0x00_7F_00, 0x00_00_7F, 0x3F_00_00, 0x00_3F_00,
    0x00_00_3F, 0x1F_00_00, 0x00_1F_00, 0x00_00_1F, 0x0F_00_00, 0x00_0F_00, 0x00_00_0F, 0x07_00_00,
    0x00_07_00, 0x00_00_07, 0x03_00_00, 0x00_03_00, 0x00_00_03, 0x01_00_00, 0x00_01_00, 0x00_00_01,
];

const DETAIL_LABEL_CSS = ["dim-label", "caption", "monospace"];
const SELECTION_GRID_CSS = ["compact"];
const TITLE_CSS = ["title-3"];
const COMPACT_CSS_CLASSES = [css`&.view > child { padding: 1px; }`];
const EMPTY_CSS_CLASSES: string[] = [];
const FILL_BATCH_DIVISOR = 4096;
const FILL_BATCH_MAX = 4096;

const getColorNameMap = (() => {
    let cache: Map<number, string> | undefined;

    return (): Map<number, string> => {
        cache ??= buildColorNameMap();

        return cache;
    };
})();

const ColorObject = registerClass(
    class extends GObject.Object {
        position = 0;
        r = 0;
        g = 0;
        b = 0;
        h = 0;
        s = 0;
        v = 0;
        described: ColorItem | null = null;

        get colorItem(): ColorItem {
            this.described ??= describeColor(this);

            return this.described;
        }
    },
    { typeName: "GtkxDemoColorObject" },
);

const ColorList = registerClass(
    class extends Gio.ListStore {
        size = 0;
        cache: Map<number, InstanceType<typeof ColorObject>> = new Map();

        truncateCache(size: number): void {
            for (const position of this.cache.keys()) {
                if (position >= size) {
                    this.cache.delete(position);
                }
            }
        }

        setSize(size: number): void {
            const previous = this.size;

            if (size === previous) {
                return;
            }

            if (size < previous) {
                this.truncateCache(size);
            }

            this.size = size;

            if (size > previous) {
                this.itemsChanged(previous, 0, size - previous);

                return;
            }

            this.itemsChanged(size, previous - size, 0);
        }

        override vfuncGetItemType(): bigint {
            return ColorObject.prototype.__type__;
        }

        override vfuncGetNItems(): number {
            return this.size;
        }

        override vfuncGetItem(position: number): GObject.Object | null {
            if (position >= this.size) {
                return null;
            }

            const cached = this.cache.get(position);

            if (cached !== undefined) {
                return cached;
            }

            const created = createColorObject(position);
            this.cache.set(position, created);

            return created;
        }
    },
    { typeName: "GtkxDemoColorList" },
);

const ColorListElement = createElementComponent<GListStoreProps<ColorList>>("GtkxDemoColorList", ColorList);

const getTnumAttrs = (() => {
    let cache: Pango.AttrList | undefined;

    return (): Pango.AttrList => {
        cache ??= createTnumAttrs();

        return cache;
    };
})();

const ColorsContext = createContext<ColorsContextValue | null>(null);

const listviewColorsDemo: Demo = {
    id: "listview-colors",
    title: "Lists/Colors",
    description:
        "This demo displays a grid of colors.\n\nIt is using a GtkGridView, and shows how to display and " +
        "sort the data in various ways. The controls for this are implemented using GtkDropDown.\n\nThe " +
        "dataset used here has up to 16 777 216 items.\n\nNote that this demo also functions as a " +
        "performance test for some of the list model machinery, and the biggest sizes here can lock up the " +
        "application for extended times when used with sorting.",
    keywords: ["GtkMultiSelection"],
    component: ListViewColorsDemo,
    titlebar: ColorsHeader,
    provider: ListViewColorsProvider,
    sourceCode,
    defaultWidth: 800,
    defaultHeight: 400,
};

function createTnumAttrs(): Pango.AttrList {
    const attrs = Pango.AttrList.new();
    attrs.insert(Pango.AttrFontFeatures.new("tnum"));

    return attrs;
}

function positionToColor(position: number): number {
    let result = 0;

    for (const [index, element] of POSITION_TO_COLOR_MAP.entries()) {
        if (position & (1 << index)) {
            result ^= element;
        }
    }

    return result;
}

function hueFromNormalized(rgb: NormalizedRgb, max: number, delta: number): number {
    if (delta === 0) {
        return 0;
    }

    if (max === rgb.r) {
        return 60 * (((rgb.g - rgb.b) / delta) % 6);
    }

    if (max === rgb.g) {
        return 60 * ((rgb.b - rgb.r) / delta + 2);
    }

    return 60 * ((rgb.r - rgb.g) / delta + 4);
}

function rgbToHsv(r: number, g: number, b: number): Hsv {
    const rgb: NormalizedRgb = { r: r / 255, g: g / 255, b: b / 255 };
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    const delta = max - min;
    const hue = hueFromNormalized(rgb, max, delta);
    const h = hue < 0 ? hue + 360 : hue;
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

function colorKey(r: number, g: number, b: number): number {
    return ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF);
}

function colorField(fields: string[], index: number): number {
    return Number(fields[index] ?? "0");
}

function addColorName(names: Map<number, string>, line: string): void {
    if (line.startsWith("#") || line.length === 0) {
        return;
    }

    const fields = line.split(/\s+/);
    const name = fields[1];

    if (name === undefined) {
        return;
    }

    const key = colorKey(colorField(fields, 3), colorField(fields, 4), colorField(fields, 5));

    if (!names.has(key)) {
        names.set(key, name);
    }
}

function buildColorNameMap(): Map<number, string> {
    const names: Map<number, string> = new Map();

    for (const line of colorNamesRaw.split("\n")) {
        addColorName(names, line);
    }

    return names;
}

function generateColorName(r: number, g: number, b: number): string {
    const hex = `${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`.toUpperCase();

    return getColorNameMap().get(colorKey(r, g, b)) ?? `#${hex}`;
}

function describeColor(color: ColorObject): ColorItem {
    const { r, g, b, h, s, v } = color;

    return {
        id: `color-${String(color.position)}`,
        name: generateColorName(r, g, b),
        hex: rgbToHex(r, g, b),
        r,
        g,
        b,
        h,
        s,
        v,
    };
}

function createColorObject(position: number): ColorObject {
    const rgb = positionToColor(position);
    const obj = new ColorObject();
    obj.position = position;
    obj.r = (rgb >> 16) & 0xFF;
    obj.g = (rgb >> 8) & 0xFF;
    obj.b = rgb & 0xFF;
    const hsv = rgbToHsv(obj.r, obj.g, obj.b);
    obj.h = hsv.h;
    obj.s = hsv.s;
    obj.v = hsv.v;

    return obj;
}

function calculateAverageColor(colors: ColorItem[]): AverageColor {
    if (colors.length === 0) {
        return { r: 128, g: 128, b: 128, hex: "#808080" };
    }

    let sumR = 0;
    let sumG = 0;
    let sumB = 0;

    for (const color of colors) {
        sumR += color.r;
        sumG += color.g;
        sumB += color.b;
    }

    const r = Math.round(sumR / colors.length);
    const g = Math.round(sumG / colors.length);
    const b = Math.round(sumB / colors.length);

    return { r, g, b, hex: rgbToHex(r, g, b) };
}

function drawColorSwatch(cr: Context, { width, height, r, g, b }: SwatchGeometry): void {
    cr.setSourceRgb(r / 255, g / 255, b / 255);
    cr.rectangle(0, 0, width, height);
    cr.fill();
}

const ColorSwatch = ({ item, size }: { item: ColorItem; size: number }) => (
    <GtkDrawingArea
        contentWidth={size}
        contentHeight={size}
        accessibleRole={Gtk.AccessibleRole.IMG}
        accessibleLabel={item.name}
        drawFunc={(_area, cr, width, height) => {
            drawColorSwatch(cr, { width, height, r: item.r, g: item.g, b: item.b });
        }}
    />
);

const renderSimpleColor: ListItemRenderer<ColorObject> = ({ item }) => (
    <ColorSwatch item={item.colorItem} size={32} />
);

const renderDetailedColor: ListItemRenderer<ColorObject> = ({ item }) => {
    const color = item.colorItem;

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={4}
            halign={Gtk.Align.CENTER}
            marginStart={2}
            marginEnd={2}
            marginTop={2}
            marginBottom={2}
        >
            <ColorSwatch item={color} size={48} />
            <GtkLabel
                label={`<b>${color.name}</b>`}
                useMarkup
                cssClasses={["caption"]}
                ellipsize={Pango.EllipsizeMode.END}
                maxWidthChars={10}
            />
            <GtkLabel
                label={`<b>R:</b> ${String(color.r)} <b>G:</b> ${String(color.g)} <b>B:</b> ${String(color.b)}`}
                useMarkup
                cssClasses={DETAIL_LABEL_CSS}
            />
            <GtkLabel
                label={`<b>H:</b> ${String(color.h)} <b>S:</b> ${String(color.s)} <b>V:</b> ${String(color.v)}`}
                useMarkup
                cssClasses={DETAIL_LABEL_CSS}
            />
        </GtkBox>
    );
};

function getCompareFn(mode: SortMode): ((a: ColorObject, b: ColorObject) => number) | null {
    switch (mode) {
        case "unsorted": {
            return null;
        }
        case "name": {
            return (a, b) => a.colorItem.name.localeCompare(b.colorItem.name);
        }
        case "red": {
            return (a, b) => b.r - a.r;
        }
        case "green": {
            return (a, b) => b.g - a.g;
        }
        case "blue": {
            return (a, b) => b.b - a.b;
        }
        case "rgb": {
            return (a, b) => b.r - a.r || b.g - a.g || b.b - a.b;
        }
        case "hue": {
            return (a, b) => b.h - a.h;
        }
        case "saturation": {
            return (a, b) => b.s - a.s;
        }
        case "value": {
            return (a, b) => b.v - a.v;
        }
        case "hsv": {
            return (a, b) => b.h - a.h || b.s - a.s || b.v - a.v;
        }
        default: {
            return null;
        }
    }
}

function compareColorObjects(
    cmp: (a: ColorObject, b: ColorObject) => number,
    a: GObject.Object | null,
    b: GObject.Object | null,
): number {
    if (a instanceof ColorObject && b instanceof ColorObject) {
        return cmp(a, b);
    }

    return 0;
}

function useColorsModels(): { element: ReactNode; models: ColorsModels | null } {
    const [colors, setColors] = useState<ColorList | null>(null);
    const [sorter, setSorter] = useState<Gtk.CustomSorter | null>(null);
    const [sortModel, setSortModel] = useState<Gtk.SortListModel | null>(null);
    const [selection, setSelection] = useState<Gtk.MultiSelection | null>(null);
    const models = useMemo(
        () => colors && sorter && sortModel && selection ? { colors, sorter, sortModel, selection } : null,
        [colors, sorter, sortModel, selection],
    );
    const element = createPortal(
        <>
            <GtkMultiSelection
                ref={setSelection}
                model={
                    (
                        <GtkSortListModel
                            ref={setSortModel}
                            incremental
                            model={<ColorListElement ref={setColors} itemType={ColorObject.prototype.__type__} />}
                        />
                    )
                }
            />
            <GtkCustomSorter ref={setSorter} />
        </>,
        rootElement,
    );

    return { element, models };
}

function reorderStore(models: ColorsModels, mode: SortMode): void {
    const cmp = getCompareFn(mode);

    if (cmp === null) {
        models.sortModel.setSorter(null);

        return;
    }

    models.sorter.setSortFunc((a, b) => compareColorObjects(cmp, a, b));
    models.sortModel.setSorter(models.sorter);
}

function useColorsSortMode(models: ColorsModels, mode: SortMode): void {
    useEffect(() => {
        reorderStore(models, mode);
    }, [models, mode]);
}

function clearStore(models: ColorsModels): void {
    models.colors.setSize(0);
}

function fillSynchronously(models: ColorsModels, colorLimit: ColorLimit, sortMode: SortMode): void {
    models.colors.setSize(colorLimit);
    reorderStore(models, sortMode);
}

function useColorsInitialFill(models: ColorsModels, colorLimit: ColorLimit, sortMode: SortMode): void {
    const fill = useEffectEvent((): void => {
        fillSynchronously(models, colorLimit, sortMode);
    });

    useLayoutEffect(() => {
        fill();
    }, []);
}

function fillNextChunk(progress: FillProgress): SourceResult {
    if (progress.appended >= progress.colorLimit) {
        return GLib.SOURCE_REMOVE;
    }

    const next = Math.min(progress.colorLimit, progress.appended + progress.increment);
    progress.models.colors.setSize(next);
    progress.appended = next;

    if (next >= progress.colorLimit) {
        progress.onComplete();

        return GLib.SOURCE_REMOVE;
    }

    return GLib.SOURCE_CONTINUE;
}

function fillIncrement(colorLimit: ColorLimit): number {
    return Math.min(FILL_BATCH_MAX, Math.max(1, Math.floor(colorLimit / FILL_BATCH_DIVISOR)));
}

function useColorsRefill({ models, gridView, colorLimit, sortMode, refillToken }: ColorsRefillOptions): void {
    const reorder = useEffectEvent((): void => {
        reorderStore(models, sortMode);
    });

    useEffect(() => {
        if (!gridView || refillToken === 0) {
            return;
        }

        clearStore(models);

        const progress: FillProgress = {
            models,
            colorLimit,
            increment: fillIncrement(colorLimit),
            appended: 0,
            onComplete: reorder,
        };

        const tickId = gridView.addTickCallback(() => fillNextChunk(progress));

        return () => {
            gridView.removeTickCallback(tickId);
        };
    }, [models, gridView, colorLimit, refillToken]);
}

function useColorsLimitFill(models: ColorsModels, colorLimit: ColorLimit, sortMode: SortMode): void {
    const previousLimitRef = useRef(colorLimit);

    const fill = useEffectEvent((): void => {
        fillSynchronously(models, colorLimit, sortMode);
    });

    useEffect(() => {
        if (previousLimitRef.current === colorLimit) {
            return;
        }

        previousLimitRef.current = colorLimit;
        fill();
    }, [colorLimit]);
}

const formatItemCount = (count: number): string => `${count.toLocaleString("en-US")} /`;

function useStoreItemCount(model: Gio.ListModel): number {
    const [itemCount, setItemCount] = useState(() => model.getNItems());

    useSignal(
        model,
        "items-changed",
        () => {
            setItemCount(model.getNItems());
        },
        { isImmediate: true },
    );

    return itemCount;
}

function collectSelectedColors(selection: Gtk.MultiSelection): ColorItem[] {
    const bitset = selection.getSelection();
    const size = Number(bitset.getSize());
    const out: ColorItem[] = [];

    for (let index = 0; index < size; index++) {
        const obj = selection.getItem(bitset.getNth(index)) as ColorObject | null;

        if (obj) {
            out.push(obj.colorItem);
        }
    }

    return out;
}

function useSelectedColors(selection: Gtk.MultiSelection): ColorItem[] {
    const [selectedColors, setSelectedColors] = useState<ColorItem[]>([]);

    useSignal(selection, "selection-changed", () => {
        setSelectedColors(collectSelectedColors(selection));
    }, {
        isImmediate: true,
    });

    return selectedColors;
}

function useColorsState() {
    const [colorLimit, setColorLimit] = useState<ColorLimit>(4096);
    const [sortMode, setSortMode] = useState<SortMode>("unsorted");
    const [displayFactory, setDisplayFactory] = useState<DisplayFactory>("colors");
    const [shouldShowSelectionInfo, setShouldShowSelectionInfo] = useState(false);
    const [refillToken, setRefillToken] = useState(0);

    return {
        colorLimit,
        setColorLimit,
        sortMode,
        setSortMode,
        displayFactory,
        setDisplayFactory,
        shouldShowSelectionInfo,
        setShouldShowSelectionInfo,
        refillToken,
        bumpRefillToken: () => {
            setRefillToken((t) => t + 1);
        },
    };
}

function useColorsComputed(state: ColorsState, models: ColorsModels) {
    const { displayFactory, bumpRefillToken } = state;
    const selectedColors = useSelectedColors(models.selection);
    const averageColor = calculateAverageColor(selectedColors);
    const shouldShowDetails = displayFactory === "everything";
    const gridCssClasses = displayFactory === "colors" ? COMPACT_CSS_CLASSES : EMPTY_CSS_CLASSES;

    const handleRefill = () => {
        models.selection.unselectAll();
        bumpRefillToken();
    };

    const handleLimitChange = (id: string | null) => {
        const limit = COLOR_LIMITS.find((l) => l.id === id);

        if (limit) {
            models.selection.unselectAll();
            state.setColorLimit(limit.value);
        }
    };

    return {
        selectedColors,
        averageColor,
        showDetails: shouldShowDetails,
        gridCssClasses,
        handleRefill,
        handleLimitChange,
    };
}

function useColorsContext(): ColorsContextValue {
    const ctx = useContext(ColorsContext);

    if (!ctx) {
        throw new Error("ColorsContext is missing");
    }

    return ctx;
}

const renderSelectionItem: ListItemRenderer<ColorItem> = ({ item }) => <ColorSwatch item={item} size={8} />;

const SelectionColorsGrid = ({ selectedColors }: { selectedColors: ColorItem[] }) => (
    <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
        <GridView
            maxColumns={200}
            cssClasses={SELECTION_GRID_CSS}
            estimatedItemHeight={32}
            selectionMode={Gtk.SelectionMode.NONE}
            renderItem={renderSelectionItem}
            items={selectedColors.map((c) => ({ id: c.id, value: c }))}
        />
    </GtkScrolledWindow>
);

const SelectionAverageSwatch = ({ averageColor }: { averageColor: AverageColor }) => (
    <GtkDrawingArea
        contentWidth={32}
        contentHeight={32}
        accessibleRole={Gtk.AccessibleRole.IMG}
        accessibleLabel={`Average color ${averageColor.hex}`}
        drawFunc={(_self, cr, w, h) => {
            drawColorSwatch(cr, {
                width: w,
                height: h,
                r: averageColor.r,
                g: averageColor.g,
                b: averageColor.b,
            });
        }}
    />
);

const SelectionInfoPanel = ({ selectedColors, averageColor }: SelectionInfoPanelProps) => (
    <GtkGrid marginStart={10} marginEnd={10} marginTop={10} marginBottom={10} rowSpacing={10} columnSpacing={10}>
        <GtkGridLayoutChild column={0} row={0} columnSpan={5}>
            <GtkLabel hexpand cssClasses={TITLE_CSS}>
                Selection
            </GtkLabel>
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={0} row={1} columnSpan={5}>
            <SelectionColorsGrid selectedColors={selectedColors} />
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={0} row={2}>
            <GtkLabel>Size:</GtkLabel>
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={1} row={2}>
            <GtkLabel name="selection-size">{String(selectedColors.length)}</GtkLabel>
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={2} row={2}>
            <GtkLabel>Average:</GtkLabel>
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={3} row={2}>
            <SelectionAverageSwatch averageColor={averageColor} />
        </GtkGridLayoutChild>
        <GtkGridLayoutChild column={4} row={2}>
            <GtkLabel hexpand></GtkLabel>
        </GtkGridLayoutChild>
    </GtkGrid>
);

const ColorsHeaderStart = () => {
    const { state, models, computed } = useColorsContext();
    const itemCount = useStoreItemCount(models.sortModel);

    return (
        <>
            <GtkToggleButton
                name="selection-toggle"
                iconName="emblem-important-symbolic"
                tooltipText="Show selection info"
                active={state.shouldShowSelectionInfo}
                onToggled={(btn) => {
                    state.setShouldShowSelectionInfo(btn.getActive());
                }}
            />
            <GtkButton label="_Refill" useUnderline onClicked={computed.handleRefill} />
            <GtkLabel attributes={getTnumAttrs()} widthChars={8} xalign={1}>
                {formatItemCount(itemCount)}
            </GtkLabel>
            <DropDown
                name="limit-dropdown"
                accessibleLabel="Color count"
                selectedId={String(state.colorLimit)}
                onSelectionChanged={computed.handleLimitChange}
                items={COLOR_LIMITS.map((l) => ({ id: l.id, value: l.label }))}
            />
        </>
    );
};

const ColorsHeaderEnd = () => {
    const { state } = useColorsContext();

    return (
        <>
            <GtkBox spacing={10}>
                <GtkLabel>Sort by:</GtkLabel>
                <DropDown
                    name="sort-dropdown"
                    accessibleLabel="Sort colors by"
                    selectedId={state.sortMode}
                    onSelectionChanged={(id) => {
                        state.setSortMode(id as SortMode);
                    }}
                    items={SORT_MODES.map((m) => ({ id: m.id, value: m.label }))}
                />
            </GtkBox>
            <GtkBox spacing={10}>
                <GtkLabel>Show:</GtkLabel>
                <DropDown
                    name="display-dropdown"
                    accessibleLabel="Color display"
                    selectedId={state.displayFactory}
                    onSelectionChanged={(id) => {
                        state.setDisplayFactory(id as DisplayFactory);
                    }}
                    items={DISPLAY_FACTORIES.map((f) => ({ id: f.id, value: f.label }))}
                />
            </GtkBox>
        </>
    );
};

const ColorsProgressBar = ({ model, colorLimit }: ColorsProgressBarProps) => {
    const itemCount = useStoreItemCount(model);

    return (
        <GtkProgressBar
            accessibleLabel="Loading colors"
            fraction={Math.min(1, itemCount / colorLimit)}
            visible={itemCount > 0 && itemCount < colorLimit}
            halign={Gtk.Align.FILL}
            valign={Gtk.Align.START}
        />
    );
};

const ColorsGridOverlay = () => {
    const { state, models, computed } = useColorsContext();
    const [gridView, setGridView] = useState<Gtk.GridView | null>(null);
    useColorsInitialFill(models, state.colorLimit, state.sortMode);
    useColorsLimitFill(models, state.colorLimit, state.sortMode);

    useColorsRefill({
        models,
        gridView,
        colorLimit: state.colorLimit,
        sortMode: state.sortMode,
        refillToken: state.refillToken,
    });

    return (
        <GtkOverlay
            name="grid-overlay"
            vexpand
            hexpand
            overlays={[
                <GtkOverlayLayoutChild key="overlay-0">
                    <ColorsProgressBar model={models.sortModel} colorLimit={state.colorLimit} />
                </GtkOverlayLayoutChild>,
            ]}
        >
            <GtkScrolledWindow name="grid-scrolled" vexpand hexpand>
                <GtkGridView
                    ref={setGridView}
                    name="color-grid"
                    minColumns={computed.showDetails ? 4 : 8}
                    maxColumns={computed.showDetails ? 12 : 24}
                    enableRubberband
                    cssClasses={computed.gridCssClasses}
                    model={models.selection}
                    factory={(
                        <ListItemFactory<ColorObject>
                            renderItem={computed.showDetails ? renderDetailedColor : renderSimpleColor}
                        />
                    )}
                />
            </GtkScrolledWindow>
        </GtkOverlay>
    );
};

function ColorsReadyProvider({ models, children }: { models: ColorsModels; children: ReactNode }) {
    const state = useColorsState();
    useColorsSortMode(models, state.sortMode);
    const computed = useColorsComputed(state, models);

    const value = {
        state,
        models,
        computed,
    };

    return <ColorsContext.Provider value={value}>{children}</ColorsContext.Provider>;
}

function ListViewColorsProvider({ children }: DemoProviderProps) {
    const { element, models } = useColorsModels();

    return (
        <>
            {element}
            {models === null ? null : <ColorsReadyProvider models={models}>{children}</ColorsReadyProvider>}
        </>
    );
}

function ColorsHeader() {
    return <GtkHeaderBar name="header-bar" start={<ColorsHeaderStart />} end={<ColorsHeaderEnd />} />;
}

function ListViewColorsDemo() {
    const { state, computed } = useColorsContext();

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkRevealer name="selection-revealer" revealChild={state.shouldShowSelectionInfo}>
                <SelectionInfoPanel selectedColors={computed.selectedColors} averageColor={computed.averageColor} />
            </GtkRevealer>
            <ColorsGridOverlay />
        </GtkBox>
    );
}

export { listviewColorsDemo };
