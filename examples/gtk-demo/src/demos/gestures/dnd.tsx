import { css, cx } from "@gtkx/css";
import * as Gdk from "@gtkx/ffi/gdk";
import * as Gio from "@gtkx/ffi/gio";
import * as GObject from "@gtkx/ffi/gobject";
import * as Graphene from "@gtkx/ffi/graphene";
import * as Gsk from "@gtkx/ffi/gsk";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkDragSource,
    GtkDropTarget,
    GtkEntry,
    GtkFixed,
    GtkGestureClick,
    GtkGestureRotate,
    GtkImage,
    GtkLabel,
    GtkPopover,
    GtkScale,
    GtkScrolledWindow,
    GtkSeparator,
} from "@gtkx/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { makeValue } from "../../gvalue.js";
import { useContextMenuGesture } from "../../use-context-menu-gesture.js";
import { useImperativeDragVisibility } from "../../use-imperative-drag-visibility.js";
import type { Demo } from "../types.js";
import sourceCode from "./dnd.tsx?raw";
import { path as trashSvgPath } from "./user-trash-opening.gpa";

const makeRectangle = (x: number, y: number, width: number, height: number): Gdk.Rectangle => {
    const rectangle = new Gdk.Rectangle();
    rectangle.x = x;
    rectangle.y = y;
    rectangle.width = width;
    rectangle.height = height;
    return rectangle;
};

const itemStyle = css`
    padding: 10px;
    margin: 1px;
`;

const defaultItemStyle = "frame";

const swatchStyle = css`
    min-width: 48px;
    min-height: 32px;
    border-radius: 4px;
`;

const rainbow1Style = css`
    background: linear-gradient(140deg, red, orange, yellow, green, blue, purple);
`;

const rainbow2Style = css`
    animation: rainbow2 1s infinite linear;

    @keyframes rainbow2 {
        0% { background: linear-gradient(0deg, red, orange, yellow, green, blue, purple); }
        25% { background: linear-gradient(90deg, red, orange, yellow, green, blue, purple); }
        50% { background: linear-gradient(180deg, red, orange, yellow, green, blue, purple); }
        75% { background: linear-gradient(270deg, red, orange, yellow, green, blue, purple); }
        100% { background: linear-gradient(360deg, red, orange, yellow, green, blue, purple); }
    }
`;

const rainbow3Style = css`
    animation: rainbow3 1s infinite linear;

    @keyframes rainbow3 {
        0% { background: linear-gradient(140deg, red, orange, yellow, green, blue, purple); }
        16.6% { background: linear-gradient(140deg, purple, red, orange, yellow, green, blue); }
        33.2% { background: linear-gradient(140deg, blue, purple, red, orange, yellow, green); }
        50% { background: linear-gradient(140deg, green, blue, purple, red, orange, yellow); }
        66.6% { background: linear-gradient(140deg, yellow, green, blue, purple, red, orange); }
        83.2% { background: linear-gradient(140deg, orange, yellow, green, blue, purple, red); }
        100% { background: linear-gradient(140deg, red, orange, yellow, green, blue, purple); }
    }
`;

const SWATCH_COLORS = [
    "red",
    "green",
    "blue",
    "magenta",
    "orange",
    "gray",
    "black",
    "yellow",
    "white",
    "brown",
    "pink",
    "cyan",
    "bisque",
    "gold",
    "maroon",
    "navy",
    "orchid",
    "olive",
    "peru",
    "salmon",
    "silver",
    "wheat",
];

const ITEM_SIZE = 40;

type ItemStyle = { type: "default" } | { type: "rgba"; cssColor: string } | { type: "cssClass"; className: string };

interface CanvasItem {
    id: string;
    label: string;
    style: ItemStyle;
    x: number;
    y: number;
    angle: number;
    angleDelta: number;
}

const gdkRgbaType = Gdk.RGBA.prototype.__gtype__;

interface ContextMenuState {
    x: number;
    y: number;
    itemId: string | null;
}

interface EditState {
    itemId: string;
}

function createRotationTransform(halfW: number, halfH: number, angle: number): Gsk.Transform | undefined {
    if (angle === 0) return undefined;

    const center = new Graphene.Point();
    center.init(halfW, halfH);
    const offset = new Graphene.Point();
    offset.init(-halfW, -halfH);

    let t: Gsk.Transform | undefined = Gsk.Transform.new();
    t = t.translate(center) ?? undefined;
    t = t?.rotate(angle) ?? undefined;
    t = t?.translate(offset) ?? undefined;
    return t;
}

function ColorSwatch({ color }: Readonly<{ color: string }>) {
    const dynamicStyle = css`
        background-color: ${color};
    `;

    const createColorProvider = useCallback(() => {
        const rgba = new Gdk.RGBA();
        rgba.parse(color);
        return Gdk.ContentProvider.newForValue(makeValue(gdkRgbaType, (v) => v.setBoxed(rgba)));
    }, [color]);

    return (
        <GtkBox name={`swatch-${color}`} cssClasses={[swatchStyle, dynamicStyle]}>
            <GtkDragSource onPrepare={createColorProvider} actions={Gdk.DragAction.COPY} />
        </GtkBox>
    );
}

function CssPatternSwatch({ id, cssClass }: Readonly<{ id: string; cssClass: string }>) {
    const createClassProvider = useCallback(() => {
        return Gdk.ContentProvider.newForValue(makeValue(GObject.Type.STRING, (v) => v.setString(cssClass)));
    }, [cssClass]);

    return (
        <GtkBox name={`pattern-${id}`} cssClasses={[swatchStyle, cssClass]}>
            <GtkDragSource onPrepare={createClassProvider} actions={Gdk.DragAction.COPY} />
        </GtkBox>
    );
}

const coloredItemStyle = css`
    &, &:hover, &:active {
        color: black;
    }
`;

function getItemStyleClass(style: ItemStyle): string[] {
    if (style.type === "default") {
        return [defaultItemStyle];
    }
    if (style.type === "cssClass") {
        return [style.className, coloredItemStyle];
    }
    return [
        css`
            &, &:hover, &:active {
                background-color: ${style.cssColor};
                background-image: none;
                color: black;
            }
        `,
    ];
}

function themeIsDark(): boolean {
    const envTheme = process.env.GTK_THEME;
    if (envTheme != null) {
        return envTheme.endsWith(":dark") || envTheme.endsWith("-dark");
    }
    const settings = Gtk.Settings.getDefault();
    if (!settings) return false;
    const themeName = settings.gtkThemeName ?? "";
    return themeName.endsWith("-dark") || themeName.endsWith(":dark");
}

function initialItemStyle(): ItemStyle {
    return { type: "rgba", cssColor: themeIsDark() ? "blue" : "yellow" };
}

function useDndState() {
    const [items, setItems] = useState<CanvasItem[]>(() => createInitialItems());
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [editState, setEditState] = useState<EditState | null>(null);
    const [trashHovering, setTrashHovering] = useState(false);
    const trashVisibility = useImperativeDragVisibility<Gtk.Box>();

    const refs = useDndRefs();
    const handlers = useDndHandlers({
        items,
        setItems,
        contextMenu,
        setContextMenu,
        setEditState,
        setTrashHovering,
        refs,
    });

    const editingItem = useMemo(
        () => (editState ? items.find((i) => i.id === editState.itemId) : null),
        [editState, items],
    );

    return {
        items,
        setItems,
        contextMenu,
        setContextMenu,
        editState,
        setEditState,
        trashHovering,
        setTrashHovering,
        trashVisibility,
        refs,
        handlers,
        editingItem,
    };
}

type DndState = ReturnType<typeof useDndState>;

const INITIAL_ITEM_COUNT = 4;
let nextItemNumber = INITIAL_ITEM_COUNT + 1;

const createInitialItems = (): CanvasItem[] => {
    const style = initialItemStyle();
    const items: CanvasItem[] = [];
    let x = 40;
    let y = 40;
    for (let i = 1; i <= INITIAL_ITEM_COUNT; i++) {
        items.push({ id: String(i), label: `Item ${i}`, style, x, y, angle: 0, angleDelta: 0 });
        x += 150;
        y += 100;
    }
    return items;
};

function useDndRefs() {
    const contextMenuRef = useRef<Gtk.Popover | null>(null);
    const entryRef = useRef<Gtk.Entry | null>(null);
    const buttonRefs = useRef<Map<string, Gtk.Widget>>(new Map());
    const itemHalves = useRef<Map<string, { halfW: number; halfH: number }>>(new Map());
    const itemRadii = useRef<Map<string, number>>(new Map());
    const dragHotspotRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    return { contextMenuRef, entryRef, buttonRefs, itemHalves, itemRadii, dragHotspotRef };
}

type DndRefs = ReturnType<typeof useDndRefs>;

function useItemBoundsObserver(items: CanvasItem[], refs: DndRefs) {
    useEffect(() => {
        for (const item of items) {
            const button = refs.buttonRefs.current.get(item.id);
            if (!button) continue;
            const [ok, bounds] = button.computeBounds(button);
            if (!ok) continue;
            const halfW = bounds.getWidth() / 2;
            const halfH = bounds.getHeight() / 2;
            refs.itemHalves.current.set(item.id, { halfW, halfH });
            refs.itemRadii.current.set(item.id, Math.hypot(halfW, halfH));
        }
    }, [items, refs]);
}

function useEntryFocusEffect(editState: EditState | null, entryRef: React.RefObject<Gtk.Entry | null>) {
    useEffect(() => {
        const entry = entryRef.current;
        if (entry && editState) {
            entry.grabFocusWithoutSelecting();
            entry.setPosition(-1);
        }
    }, [editState, entryRef]);
}

interface DndHandlerArgs {
    items: CanvasItem[];
    setItems: React.Dispatch<React.SetStateAction<CanvasItem[]>>;
    contextMenu: ContextMenuState | null;
    setContextMenu: (m: ContextMenuState | null) => void;
    setEditState: (e: EditState | null) => void;
    setTrashHovering: (v: boolean) => void;
    refs: DndRefs;
}

function useDndHandlers(args: DndHandlerArgs) {
    const itemHandlers = useItemHandlers(args);
    const contextMenuHandlers = useContextMenuHandlers(args);
    const dropHandlers = useDropHandlers(args);
    return { ...itemHandlers, ...contextMenuHandlers, ...dropHandlers };
}

function useItemHandlers(args: DndHandlerArgs) {
    const editHandlers = useItemEditHandlers(args);
    const rotateHandlers = useItemRotateHandlers(args);
    const dragHandlers = useItemDragHandlers(args);
    return { ...editHandlers, ...rotateHandlers, ...dragHandlers };
}

function useItemEditHandlers(args: DndHandlerArgs) {
    const { setItems } = args;

    const createContentProvider = useCallback(
        (itemId: string) => Gdk.ContentProvider.newForValue(makeValue(GObject.Type.STRING, (v) => v.setString(itemId))),
        [],
    );

    const toggleEditing = useCallback(
        (itemId: string) => args.setEditState(args.contextMenu?.itemId === itemId ? null : { itemId }),
        [args],
    );

    const updateItemLabel = useCallback(
        (itemId: string, label: string) =>
            setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, label } : item))),
        [setItems],
    );

    const updateItemAngle = useCallback(
        (itemId: string, angle: number) =>
            setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, angle } : item))),
        [setItems],
    );

    return { createContentProvider, toggleEditing, updateItemLabel, updateItemAngle };
}

function useItemRotateHandlers(args: DndHandlerArgs) {
    const { setItems } = args;

    const updateItemAngleDelta = useCallback(
        (itemId: string, angleDeltaDeg: number) =>
            setItems((prev) =>
                prev.map((item) => (item.id === itemId ? { ...item, angleDelta: angleDeltaDeg } : item)),
            ),
        [setItems],
    );

    const handleRotateAngleChanged = useCallback(
        (itemId: string) => (_angle: number, angleDelta: number) =>
            updateItemAngleDelta(itemId, (angleDelta * 180) / Math.PI),
        [updateItemAngleDelta],
    );

    const handleRotateEnd = useCallback(
        (itemId: string) =>
            setItems((prev) =>
                prev.map((item) =>
                    item.id === itemId ? { ...item, angle: item.angle + item.angleDelta, angleDelta: 0 } : item,
                ),
            ),
        [setItems],
    );

    return { handleRotateAngleChanged, handleRotateEnd };
}

function useItemDragHandlers(args: DndHandlerArgs) {
    const { setItems, refs } = args;

    const bringToFront = useCallback(
        (itemId: string) =>
            setItems((prev) => {
                const idx = prev.findIndex((i) => i.id === itemId);
                if (idx === -1 || idx === prev.length - 1) return prev;
                const item = prev[idx];
                if (!item) return prev;
                return [...prev.slice(0, idx), ...prev.slice(idx + 1), item];
            }),
        [setItems],
    );

    const setDragIcon = useCallback(
        (itemId: string, source: Gtk.DragSource) => {
            const button = refs.buttonRefs.current.get(itemId);
            if (!button) return;
            const paintable = Gtk.WidgetPaintable.new(button);
            const { x, y } = refs.dragHotspotRef.current;
            source.setIcon(paintable, x, y);
        },
        [refs],
    );

    return { bringToFront, setDragIcon };
}

function useContextMenuHandlers(args: DndHandlerArgs) {
    const { items, setItems, contextMenu, setContextMenu, setEditState, refs } = args;

    const handleContextMenu = useCallback(
        (clickX: number, clickY: number) => {
            const hitItem = items.find((item) => {
                const r = refs.itemRadii.current.get(item.id) ?? ITEM_SIZE;
                const size = 2 * r;
                return clickX >= item.x && clickX <= item.x + size && clickY >= item.y && clickY <= item.y + size;
            });
            setContextMenu({ x: clickX, y: clickY, itemId: hitItem?.id ?? null });
            setTimeout(() => refs.contextMenuRef.current?.popup(), 0);
        },
        [items, setContextMenu, refs],
    );

    const handleAddItem = useCallback(() => {
        if (!contextMenu) return;
        const id = String(nextItemNumber);
        const label = `Item ${nextItemNumber}`;
        nextItemNumber++;
        setItems((prev) => [
            ...prev,
            { id, label, style: initialItemStyle(), x: contextMenu.x, y: contextMenu.y, angle: 0, angleDelta: 0 },
        ]);
        refs.contextMenuRef.current?.popdown();
        setContextMenu(null);
    }, [contextMenu, setItems, setContextMenu, refs]);

    const handleEditItem = useCallback(() => {
        if (!contextMenu?.itemId) return;
        setEditState({ itemId: contextMenu.itemId });
        refs.contextMenuRef.current?.popdown();
    }, [contextMenu, setEditState, refs]);

    const handleDeleteItem = useCallback(() => {
        if (!contextMenu?.itemId) return;
        setItems((prev) => prev.filter((item) => item.id !== contextMenu.itemId));
        refs.contextMenuRef.current?.popdown();
        setContextMenu(null);
    }, [contextMenu, setItems, setContextMenu, refs]);

    return { handleContextMenu, handleAddItem, handleEditItem, handleDeleteItem };
}

function useDropHandlers(args: DndHandlerArgs) {
    const { setItems, setTrashHovering, refs } = args;

    const handleCanvasDrop = useCallback(
        (value: GObject.Value, x: number, y: number) => {
            const itemId = value.getString();
            if (itemId) {
                const r = refs.itemRadii.current.get(itemId) ?? 0;
                setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, x: x - r, y: y - r } : item)));
            }
            return true;
        },
        [setItems, refs],
    );

    const handleTrashDrop = useCallback(
        (value: GObject.Value) => {
            const itemId = value.getString();
            if (itemId) setItems((prev) => prev.filter((item) => item.id !== itemId));
            setTrashHovering(false);
            return true;
        },
        [setItems, setTrashHovering],
    );

    const handleItemColorDrop = useCallback(
        (itemId: string, value: GObject.Value) => {
            const rgba = value.getBoxed<Gdk.RGBA>();
            if (rgba instanceof Gdk.RGBA) {
                const cssColor = rgba.toString() ?? "transparent";
                setItems((prev) =>
                    prev.map((item) => (item.id === itemId ? { ...item, style: { type: "rgba", cssColor } } : item)),
                );
                return true;
            }
            const className = value.getString();
            if (className) {
                setItems((prev) =>
                    prev.map((item) =>
                        item.id === itemId ? { ...item, style: { type: "cssClass", className } } : item,
                    ),
                );
            }
            return true;
        },
        [setItems],
    );

    return { handleCanvasDrop, handleTrashDrop, handleItemColorDrop };
}

const DndItem = ({ item, dnd }: { item: CanvasItem; dnd: DndState }) => {
    const { refs, handlers, trashVisibility } = dnd;
    const halfW = refs.itemHalves.current.get(item.id)?.halfW ?? ITEM_SIZE / 2;
    const halfH = refs.itemHalves.current.get(item.id)?.halfH ?? ITEM_SIZE / 2;
    return (
        <GtkFixed.Child
            x={item.x}
            y={item.y}
            transform={createRotationTransform(halfW, halfH, item.angle + item.angleDelta)}
        >
            <GtkLabel
                ref={(ref) => {
                    if (ref) refs.buttonRefs.current.set(item.id, ref);
                    else refs.buttonRefs.current.delete(item.id);
                }}
                name={`item${item.id}`}
                label={item.label}
                cssClasses={cx(itemStyle, ...getItemStyleClass(item.style))}
            >
                <GtkGestureClick
                    onReleased={() => {
                        handlers.bringToFront(item.id);
                        handlers.toggleEditing(item.id);
                    }}
                />
                <GtkDragSource
                    onPrepare={(x: number, y: number) => {
                        refs.dragHotspotRef.current = { x, y };
                        return handlers.createContentProvider(item.id);
                    }}
                    onDragBegin={(_drag, source) => {
                        handlers.setDragIcon(item.id, source);
                        handlers.bringToFront(item.id);
                        refs.buttonRefs.current.get(item.id)?.setOpacity(0.3);
                        trashVisibility.show();
                    }}
                    onDragEnd={() => {
                        refs.buttonRefs.current.get(item.id)?.setOpacity(1);
                        trashVisibility.hide();
                    }}
                    actions={Gdk.DragAction.MOVE}
                />
                <GtkDropTarget
                    types={[gdkRgbaType, GObject.Type.STRING]}
                    actions={Gdk.DragAction.COPY}
                    onMotion={() => Gdk.DragAction.COPY}
                    onDrop={(value: GObject.Value) => handlers.handleItemColorDrop(item.id, value)}
                />
                <GtkGestureRotate
                    onAngleChanged={handlers.handleRotateAngleChanged(item.id)}
                    onEnd={() => handlers.handleRotateEnd(item.id)}
                />
            </GtkLabel>
        </GtkFixed.Child>
    );
};

const DndContextMenu = ({ dnd }: { dnd: DndState }) => {
    const { refs, contextMenu, setContextMenu, handlers } = dnd;
    return (
        <GtkFixed.Child x={0} y={0}>
            <GtkPopover
                name="context-menu"
                ref={refs.contextMenuRef}
                hasArrow={false}
                pointingTo={contextMenu ? makeRectangle(contextMenu.x, contextMenu.y, 1, 1) : undefined}
                autohide
                onClosed={() => setContextMenu(null)}
            >
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                    <GtkButton label="New" cssClasses={["flat"]} onClicked={handlers.handleAddItem} />
                    <GtkSeparator />
                    <GtkButton
                        label="Edit"
                        cssClasses={["flat"]}
                        sensitive={contextMenu?.itemId !== null}
                        onClicked={handlers.handleEditItem}
                    />
                    <GtkSeparator />
                    <GtkButton
                        label="Delete"
                        cssClasses={["flat"]}
                        sensitive={contextMenu?.itemId !== null}
                        onClicked={handlers.handleDeleteItem}
                    />
                </GtkBox>
            </GtkPopover>
        </GtkFixed.Child>
    );
};

const DndItemEditor = ({ dnd, editingItem }: { dnd: DndState; editingItem: CanvasItem }) => {
    const { refs, handlers, setEditState } = dnd;
    const halfH = refs.itemHalves.current.get(editingItem.id)?.halfH ?? ITEM_SIZE / 2;
    return (
        <GtkFixed.Child x={editingItem.x} y={editingItem.y + 2 * halfH}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkEntry
                    ref={refs.entryRef}
                    text={editingItem.label}
                    onChanged={(entry) => handlers.updateItemLabel(editingItem.id, entry.getText())}
                    widthChars={12}
                    onActivate={() => setEditState(null)}
                />
                <GtkScale
                    orientation={Gtk.Orientation.HORIZONTAL}
                    lower={0}
                    upper={360}
                    value={editingItem.angle % 360}
                    onValueChanged={(val) => handlers.updateItemAngle(editingItem.id, val)}
                    drawValue={false}
                />
            </GtkBox>
        </GtkFixed.Child>
    );
};

interface DndTrashZoneProps {
    boxRef: React.RefObject<Gtk.Box | null>;
    trashHovering: boolean;
    setTrashHovering: (v: boolean) => void;
    handleTrashDrop: (value: GObject.Value) => boolean;
}

const loadTrashPaintable = (): Gtk.Svg => {
    const bytes = Gio.resourcesLookupData(trashSvgPath, Gio.ResourceLookupFlags.NONE);
    return Gtk.Svg.newFromBytes(bytes);
};

const DndTrashZone = ({ boxRef, trashHovering, setTrashHovering, handleTrashDrop }: DndTrashZoneProps) => {
    const svg = useMemo(loadTrashPaintable, []);

    const attachFrameClockAndPlay = (image: Gtk.Widget) => {
        const frameClock = image.getFrameClock();
        if (frameClock) svg.setFrameClock(frameClock);
        svg.setState(0);
        svg.play();
    };

    return (
        <GtkFixed.Child x={20} y={20}>
            <GtkBox
                ref={boxRef}
                visible={false}
                cssClasses={[
                    css`padding: 12px;`,
                    trashHovering ? css`background-color: alpha(@error_color, 0.2); border-radius: 12px;` : "",
                ]}
            >
                <GtkDropTarget
                    types={[GObject.Type.STRING]}
                    actions={Gdk.DragAction.MOVE}
                    onEnter={() => {
                        setTrashHovering(true);
                        svg.setState(1);
                        svg.play();
                        return Gdk.DragAction.MOVE;
                    }}
                    onLeave={() => {
                        setTrashHovering(false);
                        svg.setState(0);
                        svg.play();
                    }}
                    onDrop={(value: GObject.Value) => {
                        svg.setState(0);
                        svg.play();
                        return handleTrashDrop(value);
                    }}
                />
                <GtkImage paintable={svg} pixelSize={64} cssClasses={["error"]} onRealize={attachFrameClockAndPlay} />
            </GtkBox>
        </GtkFixed.Child>
    );
};

const DndSwatchPalette = () => (
    <GtkScrolledWindow
        hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
        vscrollbarPolicy={Gtk.PolicyType.NEVER}
        minContentHeight={48}
    >
        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={4} cssClasses={["linked"]}>
            {SWATCH_COLORS.map((color) => (
                <ColorSwatch key={color} color={color} />
            ))}
            <CssPatternSwatch id="rainbow1" cssClass={rainbow1Style} />
            <CssPatternSwatch id="rainbow2" cssClass={rainbow2Style} />
            <CssPatternSwatch id="rainbow3" cssClass={rainbow3Style} />
        </GtkBox>
    </GtkScrolledWindow>
);

const DndDemo = () => {
    const dnd = useDndState();
    useItemBoundsObserver(dnd.items, dnd.refs);
    useEntryFocusEffect(dnd.editState, dnd.refs.entryRef);

    const contextMenuGesture = useContextMenuGesture({ onContextMenu: dnd.handlers.handleContextMenu });

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkFixed name="canvas" hexpand vexpand cssClasses={[css`min-height: 400px;`]}>
                <GtkDropTarget
                    types={[GObject.Type.STRING]}
                    actions={Gdk.DragAction.MOVE}
                    onMotion={() => Gdk.DragAction.MOVE}
                    onDrop={(value: GObject.Value, dropX: number, dropY: number) =>
                        dnd.handlers.handleCanvasDrop(value, dropX, dropY)
                    }
                />
                <GtkGestureClick
                    ref={contextMenuGesture.ref}
                    button={0}
                    onPressed={contextMenuGesture.onPressed}
                    onReleased={contextMenuGesture.onReleased}
                />
                {dnd.items.map((item) => (
                    <DndItem key={item.id} item={item} dnd={dnd} />
                ))}

                <DndContextMenu dnd={dnd} />
                {dnd.editingItem && <DndItemEditor dnd={dnd} editingItem={dnd.editingItem} />}
                <DndTrashZone
                    boxRef={dnd.trashVisibility.ref}
                    trashHovering={dnd.trashHovering}
                    setTrashHovering={dnd.setTrashHovering}
                    handleTrashDrop={dnd.handlers.handleTrashDrop}
                />
            </GtkFixed>

            <GtkSeparator orientation={Gtk.Orientation.HORIZONTAL} />

            <DndSwatchPalette />
        </GtkBox>
    );
};

export const dndDemo: Demo = {
    id: "dnd",
    title: "Drag-and-Drop",
    description:
        "This demo shows dragging colors and widgets. The items in this demo can be moved, recolored and rotated.\n\nThe demo also has an example for creating a menu-like popover without using a menu model.",
    keywords: ["dnd", "menu", "popover", "gesture"],
    component: DndDemo,
    sourceCode,
    defaultWidth: 640,
    defaultHeight: 480,
};
