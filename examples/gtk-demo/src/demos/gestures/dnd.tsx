import { css, cx } from "@gtkx/css";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkAdjustment,
    GtkBox,
    GtkButton,
    GtkDragSource,
    GtkDropTarget,
    GtkEntry,
    GtkFixed,
    GtkFixedLayoutChild,
    GtkGestureClick,
    GtkGestureRotate,
    GtkImage,
    GtkLabel,
    GtkPopover,
    GtkScale,
    GtkScrolledWindow,
    GtkSeparator,
} from "@gtkx/jsx/gtk";
import { useEffect, useRef, useState } from "react";
import { path as trashSvgPath } from "#data/demos/gestures/user-trash-opening.gpa";
import type { Demo } from "../types.js";
import { at } from "../../transform.js";
import { useContextMenuGesture } from "../../use-context-menu-gesture.js";
import { useImperativeDragVisibility } from "../../use-imperative-drag-visibility.js";
import sourceCode from "./dnd.tsx?raw";

type ItemStyle = { type: "default" } | { type: "rgba"; cssColor: string } | { type: "cssClass"; className: string };
type SetItems = React.Dispatch<React.SetStateAction<CanvasItem[]>>;
type DndState = ReturnType<typeof useDndState>;
type DndRefs = ReturnType<typeof useDndRefs>;

type CanvasItem = {
    id: string;
    label: string;
    style: ItemStyle;
    x: number;
    y: number;
    angle: number;
    angleDelta: number;
};

type ContextMenuState = {
    x: number;
    y: number;
    itemId: string | null;
};

type EditState = {
    itemId: string;
};

type DndHandlerArgs = {
    items: CanvasItem[];
    setItems: SetItems;
    contextMenu: ContextMenuState | null;
    setContextMenu: (m: ContextMenuState | null) => void;
    setEditState: (e: EditState | null) => void;
    setTrashHovering: (isHovering: boolean) => void;
    refs: DndRefs;
};

type ContextMenuActionArgs = {
    setItems: SetItems;
    contextMenu: ContextMenuState | null;
    setContextMenu: (m: ContextMenuState | null) => void;
    refs: DndRefs;
};

type ContextMenuEditArgs = {
    contextMenu: ContextMenuState | null;
    setEditState: (e: EditState | null) => void;
    refs: DndRefs;
};

type CanvasDropArgs = {
    setItems: SetItems;
    refs: DndRefs;
    value: GObject.Value;
    x: number;
    y: number;
};

type DndCanvasControllersProps = {
    dnd: DndState;
    gestureRef: React.RefObject<Gtk.GestureClick | null>;
    onPressed: (nPress: number, x: number, y: number) => void;
    onReleased: (nPress: number, x: number, y: number) => void;
};

type DndTrashZoneProps = {
    boxRef: React.RefObject<Gtk.Box | null>;
    trashHovering: boolean;
    setTrashHovering: (isHovering: boolean) => void;
    onTrashDrop: (value: GObject.Value) => boolean;
};

const itemStyle = css`
    padding: 10px;
    margin: 1px;
`;

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

const coloredItemStyle = css`
    &, &:hover, &:active {
        color: black;
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

const defaultItemStyle = "frame";
const ITEM_SIZE = 40;
const gdkRgbaType = Gdk.RGBA.prototype.__type__;
const INITIAL_ITEM_COUNT = 4;
const takeNextItemNumber = createItemNumberGenerator(INITIAL_ITEM_COUNT + 1);

const dndDemo: Demo = {
    id: "dnd",
    title: "Drag-and-Drop",
    description:
        "This demo shows dragging colors and widgets. The items in this demo can be moved, recolored and " +
        "rotated.\n\nThe demo also has an example for creating a menu-like popover without using a menu model.",
    keywords: ["dnd", "menu", "popover", "gesture"],
    component: DndDemo,
    sourceCode,
    defaultWidth: 640,
    defaultHeight: 480,
};

function createItemNumberGenerator(start: number) {
    let next = start;

    return () => {
        const current = next;
        next++;

        return current;
    };
}

const buildRectangle = (x: number, y: number, width: number, height: number): Gdk.Rectangle => {
    const rectangle = new Gdk.Rectangle();
    rectangle.x = x;
    rectangle.y = y;
    rectangle.width = width;
    rectangle.height = height;

    return rectangle;
};

const updateItem = (items: CanvasItem[], itemId: string, patch: Partial<CanvasItem>): CanvasItem[] =>
    items.map((item) => (item.id === itemId ? { ...item, ...patch } : item));

const rotateItemToFinalAngle = (items: CanvasItem[], itemId: string): CanvasItem[] =>
    items.map((item) => (item.id === itemId ? { ...item, angle: item.angle + item.angleDelta, angleDelta: 0 } : item));

const moveItemToFront = (items: CanvasItem[], itemId: string): CanvasItem[] => {
    const idx = items.findIndex((i) => i.id === itemId);

    if (idx === -1 || idx === items.length - 1) {
        return items;
    }

    const item = items[idx];

    if (!item) {
        return items;
    }

    return [...items.slice(0, idx), ...items.slice(idx + 1), item];
};

const findItemAt = (items: CanvasItem[], refs: DndRefs, clickX: number, clickY: number): CanvasItem | undefined =>
    items.find((item) => {
        const r = refs.itemRadii.current.get(item.id) ?? ITEM_SIZE;
        const size = 2 * r;

        return clickX >= item.x && clickX <= item.x + size && clickY >= item.y && clickY <= item.y + size;
    });

function createRotationTransform(halfW: number, halfH: number, angle: number): Gsk.Transform | undefined {
    if (angle === 0) {
        return undefined;
    }

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

const createContentProvider = (itemId: string) =>
    Gdk.ContentProvider.newForValue(GObject.buildValue(GObject.TYPE_STRING, (v) => {
        v.setString(itemId);
    }));

function ColorSwatch({ color }: { color: string }) {
    const dynamicStyle = css`
        background-color: ${color};
    `;

    const createColorProvider = () => {
        const rgba = new Gdk.RGBA();
        rgba.parse(color);

        return Gdk.ContentProvider.newForValue(GObject.buildValue(gdkRgbaType, (v) => {
            v.setBoxed(rgba);
        }));
    };

    return (
        <GtkBox
            name={`swatch-${color}`}
            cssClasses={[swatchStyle, dynamicStyle]}
            controllers={<GtkDragSource onPrepare={createColorProvider} actions={Gdk.DragAction.COPY} />}
        />
    );
}

function CssPatternSwatch({ id, cssClass }: { id: string; cssClass: string }) {
    const createClassProvider = () => {
        return Gdk.ContentProvider.newForValue(GObject.buildValue(GObject.TYPE_STRING, (v) => {
            v.setString(cssClass);
        }));
    };

    return (
        <GtkBox
            name={`pattern-${id}`}
            cssClasses={[swatchStyle, cssClass]}
            controllers={<GtkDragSource onPrepare={createClassProvider} actions={Gdk.DragAction.COPY} />}
        />
    );
}

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

function isDarkTheme(): boolean {
    const envTheme = process.env.GTK_THEME;

    if (envTheme != null) {
        return envTheme.endsWith(":dark") || envTheme.endsWith("-dark");
    }

    const settings = Gtk.Settings.getDefault();

    if (!settings) {
        return false;
    }

    const themeName = settings.gtkThemeName;

    return themeName.endsWith("-dark") || themeName.endsWith(":dark");
}

function initialItemStyle(): ItemStyle {
    return { type: "rgba", cssColor: isDarkTheme() ? "blue" : "yellow" };
}

const createInitialItems = (): CanvasItem[] => {
    const style = initialItemStyle();
    const items: CanvasItem[] = [];
    let x = 40;
    let y = 40;

    for (let i = 1; i <= INITIAL_ITEM_COUNT; i++) {
        items.push({ id: String(i), label: `Item ${String(i)}`, style, x, y, angle: 0, angleDelta: 0 });
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

    const setDragHotspot = (x: number, y: number) => {
        dragHotspotRef.current = { x, y };
    };

    const setContextMenuNode = (node: Gtk.Popover | null) => {
        contextMenuRef.current = node;
    };

    const setEntryNode = (node: Gtk.Entry | null) => {
        entryRef.current = node;
    };

    return {
        contextMenuRef,
        entryRef,
        buttonRefs,
        itemHalves,
        itemRadii,
        dragHotspotRef,
        setDragHotspot,
        setContextMenuNode,
        setEntryNode,
    };
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

    const editingItem = editState ? items.find((i) => i.id === editState.itemId) : null;

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

const measureItemBounds = (items: CanvasItem[], refs: DndRefs) => {
    for (const item of items) {
        const button = refs.buttonRefs.current.get(item.id);

        if (!button) {
            continue;
        }

        const [ok, bounds] = button.computeBounds(button);

        if (!ok) {
            continue;
        }

        const halfW = bounds.getWidth() / 2;
        const halfH = bounds.getHeight() / 2;
        refs.itemHalves.current.set(item.id, { halfW, halfH });
        refs.itemRadii.current.set(item.id, Math.hypot(halfW, halfH));
    }
};

function useItemBoundsObserver(items: CanvasItem[], refs: DndRefs) {
    useEffect(() => {
        measureItemBounds(items, refs);
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

    const toggleEditing = (itemId: string) => {
        args.setEditState(args.contextMenu?.itemId === itemId ? null : { itemId });
    };

    const updateItemLabel = (itemId: string, label: string) => {
        setItems((prev) => updateItem(prev, itemId, { label }));
    };

    const updateItemAngle = (itemId: string, angle: number) => {
        setItems((prev) => updateItem(prev, itemId, { angle }));
    };

    return { createContentProvider, toggleEditing, updateItemLabel, updateItemAngle };
}

function useItemRotateHandlers(args: DndHandlerArgs) {
    const { setItems } = args;

    const updateItemAngleDelta = (itemId: string, angleDeltaDeg: number) => {
        setItems((prev) => updateItem(prev, itemId, { angleDelta: angleDeltaDeg }));
    };

    const handleRotateAngleChanged = (itemId: string) => (_angle: number, angleDelta: number) => {
        updateItemAngleDelta(itemId, (angleDelta * 180) / Math.PI);
    };

    const handleRotateEnd = (itemId: string) => {
        setItems((prev) => rotateItemToFinalAngle(prev, itemId));
    };

    return { handleRotateAngleChanged, handleRotateEnd };
}

const applyDragIcon = (
    button: Gtk.Widget | undefined,
    hotspot: { x: number; y: number },
    source: Gtk.DragSource,
) => {
    if (!button) {
        return;
    }

    const paintable = Gtk.WidgetPaintable.new(button);
    source.setIcon(paintable, Math.round(hotspot.x), Math.round(hotspot.y));
};

function useItemDragHandlers(args: DndHandlerArgs) {
    const { setItems, refs } = args;

    const bringToFront = (itemId: string) => {
        setItems((prev) => moveItemToFront(prev, itemId));
    };

    const setDragIcon = (itemId: string, source: Gtk.DragSource) => {
        applyDragIcon(refs.buttonRefs.current.get(itemId), refs.dragHotspotRef.current, source);
    };

    return { bringToFront, setDragIcon };
}

const addItemAtContextMenu = ({ setItems, contextMenu, setContextMenu, refs }: ContextMenuActionArgs) => {
    if (!contextMenu) {
        return;
    }

    const number = takeNextItemNumber();
    const id = String(number);
    const label = `Item ${String(number)}`;

    setItems((prev) => [
        ...prev,
        { id, label, style: initialItemStyle(), x: contextMenu.x, y: contextMenu.y, angle: 0, angleDelta: 0 },
    ]);

    refs.contextMenuRef.current?.popdown();
    setContextMenu(null);
};

const editItemAtContextMenu = ({ contextMenu, setEditState, refs }: ContextMenuEditArgs) => {
    if (!contextMenu?.itemId) {
        return;
    }

    setEditState({ itemId: contextMenu.itemId });
    refs.contextMenuRef.current?.popdown();
};

const deleteItemAtContextMenu = ({ setItems, contextMenu, setContextMenu, refs }: ContextMenuActionArgs) => {
    const itemId = contextMenu?.itemId;

    if (!itemId) {
        return;
    }

    setItems((prev) => prev.filter((item) => item.id !== itemId));
    refs.contextMenuRef.current?.popdown();
    setContextMenu(null);
};

function useContextMenuHandlers(args: DndHandlerArgs) {
    const { items, setItems, contextMenu, setContextMenu, setEditState, refs } = args;

    const handleContextMenu = (clickX: number, clickY: number) => {
        const hitItem = findItemAt(items, refs, clickX, clickY);
        setContextMenu({ x: clickX, y: clickY, itemId: hitItem?.id ?? null });
        setTimeout(() => refs.contextMenuRef.current?.popup(), 0);
    };

    const handleAddItem = () => {
        addItemAtContextMenu({ setItems, contextMenu, setContextMenu, refs });
    };

    const handleEditItem = () => {
        editItemAtContextMenu({ contextMenu, setEditState, refs });
    };

    const handleDeleteItem = () => {
        deleteItemAtContextMenu({ setItems, contextMenu, setContextMenu, refs });
    };

    return { handleContextMenu, handleAddItem, handleEditItem, handleDeleteItem };
}

const didApplyCanvasDrop = ({ setItems, refs, value, x, y }: CanvasDropArgs): boolean => {
    const itemId = value.getString();

    if (itemId) {
        const r = refs.itemRadii.current.get(itemId) ?? 0;
        setItems((prev) => updateItem(prev, itemId, { x: x - r, y: y - r }));
    }

    return true;
};

const didApplyTrashDrop = (
    setItems: SetItems,
    setTrashHovering: (isHovering: boolean) => void,
    value: GObject.Value,
): boolean => {
    const itemId = value.getString();

    if (itemId) {
        setItems((prev) => prev.filter((item) => item.id !== itemId));
    }

    setTrashHovering(false);

    return true;
};

const itemStyleFromValue = (value: GObject.Value): ItemStyle | null => {
    const rgba = value.getBoxed<Gdk.RGBA>();

    if (rgba instanceof Gdk.RGBA) {
        return { type: "rgba", cssColor: rgba.toString() };
    }

    const className = value.getString();

    if (className) {
        return { type: "cssClass", className };
    }

    return null;
};

const didApplyItemColorDrop = (setItems: SetItems, itemId: string, value: GObject.Value): boolean => {
    const style = itemStyleFromValue(value);

    if (style) {
        setItems((prev) => updateItem(prev, itemId, { style }));
    }

    return true;
};

function useDropHandlers(args: DndHandlerArgs) {
    const { setItems, setTrashHovering, refs } = args;

    const didHandleCanvasDrop = (value: GObject.Value, x: number, y: number) =>
        didApplyCanvasDrop({ setItems, refs, value, x, y });

    const didHandleTrashDrop = (value: GObject.Value) => didApplyTrashDrop(setItems, setTrashHovering, value);

    const didHandleItemColorDrop = (itemId: string, value: GObject.Value) =>
        didApplyItemColorDrop(setItems, itemId, value);

    return { didHandleCanvasDrop, didHandleTrashDrop, didHandleItemColorDrop };
}

const DndItemControllers = ({ item, dnd }: { item: CanvasItem; dnd: DndState }) => {
    const { refs, handlers, trashVisibility } = dnd;

    return (
        <>
            <GtkGestureClick
                onReleased={() => {
                    handlers.bringToFront(item.id);
                    handlers.toggleEditing(item.id);
                }}
            />
            <GtkDragSource
                onPrepare={(x: number, y: number) => {
                    refs.setDragHotspot(x, y);

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
                types={[gdkRgbaType, GObject.TYPE_STRING]}
                actions={Gdk.DragAction.COPY}
                onMotion={() => Gdk.DragAction.COPY}
                onDrop={(value: GObject.Value) => handlers.didHandleItemColorDrop(item.id, value)}
            />
            <GtkGestureRotate
                onAngleChanged={handlers.handleRotateAngleChanged(item.id)}
                onEnd={() => {
                    handlers.handleRotateEnd(item.id);
                }}
            />
        </>
    );
};

const DndItem = ({ item, dnd }: { item: CanvasItem; dnd: DndState }) => {
    const { refs } = dnd;
    const halfW = refs.itemHalves.current.get(item.id)?.halfW ?? ITEM_SIZE / 2;
    const halfH = refs.itemHalves.current.get(item.id)?.halfH ?? ITEM_SIZE / 2;

    return (
        <GtkFixedLayoutChild
            transform={at(item.x, item.y, createRotationTransform(halfW, halfH, item.angle + item.angleDelta))}
        >
            <GtkLabel
                ref={(node) => {
                    if (node) {
                        refs.buttonRefs.current.set(item.id, node);
                    } else {
                        refs.buttonRefs.current.delete(item.id);
                    }
                }}
                name={`item${item.id}`}
                cssClasses={cx(itemStyle, ...getItemStyleClass(item.style))}
                controllers={<DndItemControllers item={item} dnd={dnd} />}
            >
                {item.label}
            </GtkLabel>
        </GtkFixedLayoutChild>
    );
};

const DndContextMenu = ({ dnd }: { dnd: DndState }) => {
    const { refs, contextMenu, setContextMenu, handlers } = dnd;

    return (
        <GtkPopover
            name="context-menu"
            ref={(node) => {
                refs.setContextMenuNode(node);
            }}
            hasArrow={false}
            pointingTo={contextMenu ? buildRectangle(contextMenu.x, contextMenu.y, 1, 1) : undefined}
            autohide
            onClosed={() => {
                setContextMenu(null);
            }}
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
    );
};

const DndItemEditor = ({ dnd, editingItem }: { dnd: DndState; editingItem: CanvasItem }) => {
    const { refs, handlers, setEditState } = dnd;
    const halfH = refs.itemHalves.current.get(editingItem.id)?.halfH ?? ITEM_SIZE / 2;

    return (
        <GtkFixedLayoutChild transform={at(editingItem.x, editingItem.y + 2 * halfH)}>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkEntry
                    ref={(node) => {
                        refs.setEntryNode(node);
                    }}
                    text={editingItem.label}
                    onChanged={(entry) => {
                        handlers.updateItemLabel(editingItem.id, entry.getText());
                    }}
                    widthChars={12}
                    onActivate={() => {
                        setEditState(null);
                    }}
                />
                <GtkScale
                    orientation={Gtk.Orientation.HORIZONTAL}
                    adjustment={<GtkAdjustment value={editingItem.angle % 360} lower={0} upper={360} />}
                    onValueChanged={(scale) => {
                        handlers.updateItemAngle(editingItem.id, scale.getValue());
                    }}
                    drawValue={false}
                />
            </GtkBox>
        </GtkFixedLayoutChild>
    );
};

const loadTrashPaintable = (): Gtk.Svg => {
    const bytes = Gio.resourcesLookupData(trashSvgPath, Gio.ResourceLookupFlags.NONE);

    return Gtk.Svg.newFromBytes(bytes);
};

const DndTrashZone = ({ boxRef, trashHovering, setTrashHovering, onTrashDrop }: DndTrashZoneProps) => {
    const [svg] = useState(loadTrashPaintable);

    const attachFrameClockAndPlay = (image: Gtk.Widget) => {
        const frameClock = image.getFrameClock();

        if (frameClock) {
            svg.setFrameClock(frameClock);
        }

        svg.setState(0);
        svg.play();
    };

    return (
        <GtkFixedLayoutChild transform={at(20, 20)}>
            <GtkBox
                name="trash-zone"
                ref={(node) => {
                    boxRef.current = node;
                }}
                visible={false}
                cssClasses={[
                    css`padding: 12px;`,
                    trashHovering ? css`background-color: alpha(@error_color, 0.2); border-radius: 12px;` : "",
                ]}
                controllers={(
                    <GtkDropTarget
                        types={[GObject.TYPE_STRING]}
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

                            return onTrashDrop(value);
                        }}
                    />
                )}
            >
                <GtkImage paintable={svg} pixelSize={64} cssClasses={["error"]} onRealize={attachFrameClockAndPlay} />
            </GtkBox>
        </GtkFixedLayoutChild>
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

const DndCanvasControllers = ({ dnd, gestureRef, onPressed, onReleased }: DndCanvasControllersProps) => (
    <>
        <GtkDropTarget
            types={[GObject.TYPE_STRING]}
            actions={Gdk.DragAction.MOVE}
            onMotion={() => Gdk.DragAction.MOVE}
            onDrop={(value: GObject.Value, dropX: number, dropY: number) =>
                dnd.handlers.didHandleCanvasDrop(value, dropX, dropY)}
        />
        <GtkGestureClick ref={gestureRef} button={0} onPressed={onPressed} onReleased={onReleased} />
    </>
);

function DndDemo() {
    const dnd = useDndState();
    useItemBoundsObserver(dnd.items, dnd.refs);
    useEntryFocusEffect(dnd.editState, dnd.refs.entryRef);
    const contextMenuGesture = useContextMenuGesture({ onContextMenu: dnd.handlers.handleContextMenu });

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkFixed
                name="canvas"
                hexpand
                vexpand
                cssClasses={[css`min-height: 400px;`]}
                controllers={(
                    <DndCanvasControllers
                        dnd={dnd}
                        gestureRef={contextMenuGesture.ref}
                        onPressed={contextMenuGesture.onPressed}
                        onReleased={contextMenuGesture.onReleased}
                    />
                )}
            >
                {dnd.items.map((item) => (
                    <DndItem key={item.id} item={item} dnd={dnd} />
                ))}

                <DndContextMenu dnd={dnd} />
                {dnd.editingItem && <DndItemEditor dnd={dnd} editingItem={dnd.editingItem} />}
                <DndTrashZone
                    boxRef={dnd.trashVisibility.ref}
                    trashHovering={dnd.trashHovering}
                    setTrashHovering={dnd.setTrashHovering}
                    onTrashDrop={dnd.handlers.didHandleTrashDrop}
                />
            </GtkFixed>

            <GtkSeparator orientation={Gtk.Orientation.HORIZONTAL} />

            <DndSwatchPalette />
        </GtkBox>
    );
}

export { dndDemo };
