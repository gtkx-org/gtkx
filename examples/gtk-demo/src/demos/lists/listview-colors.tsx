import type { Context } from "@gtkx/gi/cairo";
import { DropDown, GridView, type ListItemRenderer } from "@gtkx/components";
import { css } from "@gtkx/css";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import {
    GtkBox,
    GtkButton,
    GtkDrawingArea,
    GtkGrid,
    GtkGridLayoutChild,
    GtkGridView,
    GtkHeaderBar,
    GtkLabel,
    GtkOverlay,
    GtkOverlayLayoutChild,
    GtkProgressBar,
    GtkRevealer,
    GtkScrolledWindow,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { useSignal } from "@gtkx/react";
import { registerClass } from "@gtkx/runtime";
import {
    createContext,
    useCallback,
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

type DetailCell = {
    area: Gtk.DrawingArea;
    nameLabel: Gtk.Label;
    rgbLabel: Gtk.Label;
    hsvLabel: Gtk.Label;
};

type ColorList = InstanceType<typeof ColorList>;

type ColorsModels = {
    colors: ColorList;
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
const colorNameMap = buildColorNameMap();

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

        override getItemType(): bigint {
            return ColorObject.prototype.__type__;
        }

        override getNItems(): number {
            return this.size;
        }

        override getItem(position: number): GObject.Object | null {
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

    return colorNameMap.get(colorKey(r, g, b)) ?? `#${hex}`;
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

function bindColorSwatch(area: Gtk.DrawingArea, item: ColorItem): void {
    area.setDrawFunc((_area, cr, w, h) => {
        drawColorSwatch(cr, { width: w, height: h, r: item.r, g: item.g, b: item.b });
    });

    area.queueDraw();
}

function listItemHandler(handler: (listItem: Gtk.ListItem) => void) {
    return (listItem: GObject.Object) => {
        if (listItem instanceof Gtk.ListItem) {
            handler(listItem);
        }
    };
}

function setupSwatchItem(listItem: Gtk.ListItem): void {
    const area = new Gtk.DrawingArea();
    area.setContentWidth(32);
    area.setContentHeight(32);
    listItem.setChild(area);
}

function bindSwatchItem(listItem: Gtk.ListItem): void {
    const area = listItem.getChild();
    const item = listItem.getItem();

    if (area instanceof Gtk.DrawingArea && item instanceof ColorObject) {
        bindColorSwatch(area, item.colorItem);
    }
}

function createSimpleColorFactory(): Gtk.SignalListItemFactory {
    const factory = Gtk.SignalListItemFactory.new();
    factory.on("setup", listItemHandler(setupSwatchItem));
    factory.on("bind", listItemHandler(bindSwatchItem));

    return factory;
}

function createDetailCell(): { box: Gtk.Box; cell: DetailCell } {
    const area = new Gtk.DrawingArea();
    area.setContentWidth(48);
    area.setContentHeight(48);
    const nameLabel = new Gtk.Label();
    nameLabel.setUseMarkup(true);
    nameLabel.setCssClasses(["caption"]);
    nameLabel.setEllipsize(Pango.EllipsizeMode.END);
    nameLabel.setMaxWidthChars(10);
    const rgbLabel = new Gtk.Label();
    rgbLabel.setUseMarkup(true);
    rgbLabel.setCssClasses(DETAIL_LABEL_CSS);
    const hsvLabel = new Gtk.Label();
    hsvLabel.setUseMarkup(true);
    hsvLabel.setCssClasses(DETAIL_LABEL_CSS);
    const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 });
    box.setHalign(Gtk.Align.CENTER);
    box.setMarginStart(2);
    box.setMarginEnd(2);
    box.setMarginTop(2);
    box.setMarginBottom(2);
    box.append(area);
    box.append(nameLabel);
    box.append(rgbLabel);
    box.append(hsvLabel);

    return { box, cell: { area, nameLabel, rgbLabel, hsvLabel } };
}

function bindDetailCell(cell: DetailCell, item: ColorItem): void {
    bindColorSwatch(cell.area, item);
    cell.nameLabel.setLabel(`<b>${item.name}</b>`);
    cell.rgbLabel.setLabel(`<b>R:</b> ${String(item.r)} <b>G:</b> ${String(item.g)} <b>B:</b> ${String(item.b)}`);
    cell.hsvLabel.setLabel(`<b>H:</b> ${String(item.h)} <b>S:</b> ${String(item.s)} <b>V:</b> ${String(item.v)}`);
}

function bindDetailItem(cells: WeakMap<Gtk.ListItem, DetailCell>, listItem: Gtk.ListItem): void {
    const cell = cells.get(listItem);
    const item = listItem.getItem();

    if (cell !== undefined && item instanceof ColorObject) {
        bindDetailCell(cell, item.colorItem);
    }
}

function createDetailColorFactory(): Gtk.SignalListItemFactory {
    const cells: WeakMap<Gtk.ListItem, DetailCell> = new WeakMap();
    const factory = Gtk.SignalListItemFactory.new();

    factory.on(
        "setup",
        listItemHandler((listItem) => {
            const { box, cell } = createDetailCell();
            cells.set(listItem, cell);
            listItem.setChild(box);
        }),
    );

    factory.on(
        "bind",
        listItemHandler((listItem) => {
            bindDetailItem(cells, listItem);
        }),
    );

    factory.on(
        "teardown",
        listItemHandler((listItem) => {
            cells.delete(listItem);
        }),
    );

    return factory;
}

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

function setColorCount(colors: ColorList, size: number): void {
    const previous = colors.size;

    if (size === previous) {
        return;
    }

    colors.size = size;

    if (size > previous) {
        colors.itemsChanged(previous, 0, size - previous);

        return;
    }

    colors.itemsChanged(size, previous - size, 0);
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

function sorterFor(mode: SortMode): Gtk.Sorter | null {
    const cmp = getCompareFn(mode);

    if (!cmp) {
        return null;
    }

    return Gtk.CustomSorter.new((a, b) => compareColorObjects(cmp, a, b));
}

function useColorsModels(): ColorsModels {
    const [models] = useState<ColorsModels>(() => {
        const colors = new ColorList({ itemType: ColorObject.prototype.__type__ });
        const sortModel = Gtk.SortListModel.new(colors, null);
        sortModel.setIncremental(true);

        return { colors, sortModel, selection: new Gtk.MultiSelection({ model: sortModel }) };
    });

    return models;
}

function reorderStore(models: ColorsModels, mode: SortMode): void {
    models.sortModel.setSorter(sorterFor(mode));
}

function useColorsSortMode(models: ColorsModels, mode: SortMode): void {
    useEffect(() => {
        reorderStore(models, mode);
    }, [models, mode]);
}

function clearStore(models: ColorsModels): void {
    setColorCount(models.colors, 0);
}

function fillSynchronously(models: ColorsModels, colorLimit: ColorLimit, sortMode: SortMode): void {
    setColorCount(models.colors, colorLimit);
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

function shouldContinueFill(progress: FillProgress): boolean {
    if (progress.appended >= progress.colorLimit) {
        return GLib.SOURCE_REMOVE;
    }

    const next = Math.min(progress.colorLimit, progress.appended + progress.increment);
    setColorCount(progress.models.colors, next);
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

        const tickId = gridView.addTickCallback(() => shouldContinueFill(progress));

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

function useStoreCountLabel(model: Gio.ListModel, labelRef: React.RefObject<Gtk.Label | null>): void {
    useSignal(
        model,
        "items-changed",
        () => {
            labelRef.current?.setLabel(formatItemCount(model.getNItems()));
        },
        { isImmediate: true },
    );
}

function useStoreProgressBar(
    model: Gio.ListModel,
    colorLimit: ColorLimit,
    progressBarRef: React.RefObject<Gtk.ProgressBar | null>,
): void {
    const update = useCallback(() => {
        const bar = progressBarRef.current;

        if (!bar) {
            return;
        }

        const itemCount = model.getNItems();
        bar.setFraction(Math.min(1, itemCount / colorLimit));
        bar.setVisible(itemCount > 0 && itemCount < colorLimit);
    }, [model, colorLimit, progressBarRef]);

    useSignal(model, "items-changed", update, { isImmediate: true });

    useEffect(() => {
        update();
    }, [update]);
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

    const handleLimitChange = (id: string) => {
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

const renderSelectionItem: ListItemRenderer<ColorItem> = ({ item }) => (
    <GtkDrawingArea
        contentWidth={8}
        contentHeight={8}
        drawFunc={(_self, cr, w, h) => {
            drawColorSwatch(cr, { width: w, height: h, r: item.r, g: item.g, b: item.b });
        }}
    />
);

const SelectionColorsGrid = ({ selectedColors }: { selectedColors: ColorItem[] }) => (
    <GtkScrolledWindow hscrollbarPolicy={Gtk.PolicyType.NEVER} vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}>
        <GridView
            maxColumns={200}
            cssClasses={SELECTION_GRID_CSS}
            estimatedItemHeight={32}
            renderItem={renderSelectionItem}
            items={selectedColors.map((c) => ({ id: c.id, value: c }))}
        />
    </GtkScrolledWindow>
);

const SelectionAverageSwatch = ({ averageColor }: { averageColor: AverageColor }) => (
    <GtkDrawingArea
        contentWidth={32}
        contentHeight={32}
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
    const countLabelRef = useRef<Gtk.Label | null>(null);
    useStoreCountLabel(models.sortModel, countLabelRef);

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
            <GtkLabel ref={countLabelRef} attributes={getTnumAttrs()} widthChars={8} xalign={1}>
                {formatItemCount(models.sortModel.getNItems())}
            </GtkLabel>
            <DropDown
                name="limit-dropdown"
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
    const progressBarRef = useRef<Gtk.ProgressBar | null>(null);
    useStoreProgressBar(model, colorLimit, progressBarRef);

    return (
        <GtkProgressBar
            ref={(node) => {
                progressBarRef.current = node;
            }}
            visible={false}
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

    const factory = useMemo(
        () => (computed.showDetails ? createDetailColorFactory() : createSimpleColorFactory()),
        [computed.showDetails],
    );

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
                    factory={factory}
                />
            </GtkScrolledWindow>
        </GtkOverlay>
    );
};

function ListViewColorsProvider({ children }: DemoProviderProps) {
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
