import { css, cx } from "@gtkx/css";
import * as Gdk from "@gtkx/ffi/gdk";
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
    GtkPopover,
    GtkScale,
    GtkScrolledWindow,
    GtkSeparator,
    x,
} from "@gtkx/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./dnd.tsx?raw";

const itemStyle = css`
    min-width: 60px;
    min-height: 60px;
    border-radius: 8px;
    font-size: 18px;
    font-weight: bold;
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
    "coral",
];

const ITEM_SIZE = 60;

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

let gdkRgbaTypeCache: number | null = null;
function getGdkRgbaType(): number {
    if (gdkRgbaTypeCache === null) {
        gdkRgbaTypeCache = GObject.typeFromName("GdkRGBA");
    }
    return gdkRgbaTypeCache;
}

interface ContextMenuState {
    x: number;
    y: number;
    itemId: string | null;
}

interface EditState {
    itemId: string;
}

let nextId = 5;

function createRotationTransform(angle: number): Gsk.Transform | undefined {
    if (angle === 0) return undefined;

    const center = new Graphene.Point();
    center.init(ITEM_SIZE / 2, ITEM_SIZE / 2);
    const offset = new Graphene.Point();
    offset.init(-ITEM_SIZE / 2, -ITEM_SIZE / 2);

    let t: Gsk.Transform | undefined = new Gsk.Transform();
    t = t.translate(center) ?? undefined;
    t = t?.rotate(angle) ?? undefined;
    t = t?.translate(offset) ?? undefined;
    return t;
}

function ColorSwatch({ color }: { color: string }) {
    const dynamicStyle = css`
        background-color: ${color};
    `;

    const createColorProvider = useCallback(() => {
        const rgba = new Gdk.RGBA();
        rgba.parse(color);
        return Gdk.ContentProvider.newForValue(GObject.Value.newFromBoxed(rgba));
    }, [color]);

    return (
        <GtkBox cssClasses={[swatchStyle, dynamicStyle]}>
            <GtkDragSource onPrepare={createColorProvider} actions={Gdk.DragAction.COPY} />
        </GtkBox>
    );
}

function CssPatternSwatch({ cssClass }: { cssClass: string }) {
    const createClassProvider = useCallback(() => {
        return Gdk.ContentProvider.newForValue(GObject.Value.newFromString(cssClass));
    }, [cssClass]);

    return (
        <GtkBox cssClasses={[swatchStyle, cssClass]}>
            <GtkDragSource onPrepare={createClassProvider} actions={Gdk.DragAction.COPY} />
        </GtkBox>
    );
}

function getItemStyleClass(style: ItemStyle): string {
    if (style.type === "default") {
        return defaultItemStyle;
    }
    if (style.type === "cssClass") {
        return style.className;
    }
    return css`
        &, &:hover, &:active {
            background-color: ${style.cssColor};
            background-image: none;
        }
    `;
}

function themeIsDark(): boolean {
    const settings = Gtk.Settings.getDefault();
    if (!settings) return false;
    if (settings.getGtkApplicationPreferDarkTheme()) return true;
    const themeName = settings.getGtkThemeName() ?? "";
    return themeName.endsWith("-dark") || themeName.endsWith(":dark") || themeName.endsWith("-Dark");
}

function initialItemStyle(): ItemStyle {
    return { type: "rgba", cssColor: themeIsDark() ? "blue" : "yellow" };
}

const DndDemo = ({ window }: DemoProps) => {
    useEffect(() => {
        const win = window.current;
        if (win) {
            win.setDefaultSize(640, 480);
        }
    }, [window]);

    const [items, setItems] = useState<CanvasItem[]>(() => {
        const style = initialItemStyle();
        return [
            { id: "1", label: "Item 1", style, x: 40, y: 40, angle: 0, angleDelta: 0 },
            { id: "2", label: "Item 2", style, x: 190, y: 140, angle: 0, angleDelta: 0 },
            { id: "3", label: "Item 3", style, x: 340, y: 240, angle: 0, angleDelta: 0 },
            { id: "4", label: "Item 4", style, x: 490, y: 340, angle: 0, angleDelta: 0 },
        ];
    });
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [editState, setEditState] = useState<EditState | null>(null);
    const [isDragging, setIsDragging] = useState<string | null>(null);
    const [trashHovering, setTrashHovering] = useState(false);

    const contextMenuRef = useRef<Gtk.Popover | null>(null);
    const buttonRefs = useRef<Map<string, Gtk.Button>>(new Map());
    const dragHotspotRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    const createContentProvider = useCallback((itemId: string) => {
        return Gdk.ContentProvider.newForValue(GObject.Value.newFromString(itemId));
    }, []);

    const handleCanvasDrop = useCallback((value: GObject.Value, x: number, y: number) => {
        const itemId = value.getString();
        if (itemId) {
            const { x: hx, y: hy } = dragHotspotRef.current;
            setItems((prev) =>
                prev.map((item) => {
                    if (item.id !== itemId) return item;
                    const rad = ((item.angle + item.angleDelta) * Math.PI) / 180;
                    const cx = ITEM_SIZE / 2;
                    const cy = ITEM_SIZE / 2;
                    const rx = cx + (hx - cx) * Math.cos(rad) - (hy - cy) * Math.sin(rad);
                    const ry = cy + (hx - cx) * Math.sin(rad) + (hy - cy) * Math.cos(rad);
                    return { ...item, x: x - rx, y: y - ry };
                }),
            );
        }
        return true;
    }, []);

    const handleTrashDrop = useCallback((value: GObject.Value) => {
        const itemId = value.getString();
        if (itemId) {
            setItems((prev) => prev.filter((item) => item.id !== itemId));
        }
        setTrashHovering(false);
        return true;
    }, []);

    const handleContextMenu = useCallback(
        (clickX: number, clickY: number) => {
            const hitItem = items.find(
                (item) =>
                    clickX >= item.x &&
                    clickX <= item.x + ITEM_SIZE &&
                    clickY >= item.y &&
                    clickY <= item.y + ITEM_SIZE,
            );
            setContextMenu({ x: clickX, y: clickY, itemId: hitItem?.id ?? null });
            setTimeout(() => contextMenuRef.current?.popup(), 0);
        },
        [items],
    );

    const handleAddItem = useCallback(() => {
        if (!contextMenu) return;
        const id = String(nextId);
        const label = `Item ${nextId}`;
        nextId++;
        setItems((prev) => [
            ...prev,
            {
                id,
                label,
                style: { type: "default" },
                x: contextMenu.x - ITEM_SIZE / 2,
                y: contextMenu.y - ITEM_SIZE / 2,
                angle: 0,
                angleDelta: 0,
            },
        ]);
        contextMenuRef.current?.popdown();
        setContextMenu(null);
    }, [contextMenu]);

    const handleEditItem = useCallback(() => {
        if (!contextMenu?.itemId) return;
        setEditState({ itemId: contextMenu.itemId });
        contextMenuRef.current?.popdown();
    }, [contextMenu]);

    const handleDeleteItem = useCallback(() => {
        if (!contextMenu?.itemId) return;
        setItems((prev) => prev.filter((item) => item.id !== contextMenu.itemId));
        contextMenuRef.current?.popdown();
        setContextMenu(null);
    }, [contextMenu]);

    const toggleEditing = useCallback((itemId: string) => {
        setEditState((prev) => (prev?.itemId === itemId ? null : { itemId }));
    }, []);

    const updateItemLabel = useCallback((itemId: string, label: string) => {
        setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, label } : item)));
    }, []);

    const updateItemAngle = useCallback((itemId: string, angle: number) => {
        setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, angle } : item)));
    }, []);

    const handleRotateAngleChanged = useCallback(
        (itemId: string) => (_angle: number, angleDelta: number) => {
            const angleDeltaDeg = (angleDelta * 180) / Math.PI;
            setItems((prev) =>
                prev.map((item) => (item.id === itemId ? { ...item, angleDelta: angleDeltaDeg } : item)),
            );
        },
        [],
    );

    const handleRotateEnd = useCallback((itemId: string) => {
        setItems((prev) =>
            prev.map((item) =>
                item.id === itemId ? { ...item, angle: item.angle + item.angleDelta, angleDelta: 0 } : item,
            ),
        );
    }, []);

    const handleItemColorDrop = useCallback((itemId: string, value: GObject.Value) => {
        const gtype = value.getType();
        if (gtype === getGdkRgbaType()) {
            const rgba = value.getBoxed(Gdk.RGBA);
            if (rgba) {
                const cssColor = rgba.toString() ?? "transparent";
                setItems((prev) =>
                    prev.map((item) => (item.id === itemId ? { ...item, style: { type: "rgba", cssColor } } : item)),
                );
            }
        } else if (gtype === GObject.Type.STRING) {
            const className = value.getString();
            if (className) {
                setItems((prev) =>
                    prev.map((item) =>
                        item.id === itemId ? { ...item, style: { type: "cssClass", className } } : item,
                    ),
                );
            }
        }
        return true;
    }, []);

    const setDragIcon = useCallback((itemId: string) => {
        const button = buttonRefs.current.get(itemId);
        if (!button) return;

        const controllers = button.observeControllers();
        const count = controllers.getNItems();

        for (let i = 0; i < count; i++) {
            const controller = controllers.getObject(i);
            if (controller instanceof Gtk.DragSource) {
                const paintable = new Gtk.WidgetPaintable(button);
                const { x, y } = dragHotspotRef.current;
                controller.setIcon(x, y, paintable);
                break;
            }
        }
    }, []);

    const bringToFront = useCallback((itemId: string) => {
        setItems((prev) => {
            const idx = prev.findIndex((i) => i.id === itemId);
            if (idx === -1 || idx === prev.length - 1) return prev;
            const item = prev[idx];
            if (!item) return prev;
            return [...prev.slice(0, idx), ...prev.slice(idx + 1), item];
        });
    }, []);

    const editingItem = useMemo(
        () => (editState ? items.find((i) => i.id === editState.itemId) : null),
        [editState, items],
    );

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkFixed hexpand vexpand cssClasses={[css`min-height: 400px;`]}>
                <GtkDropTarget
                    types={[GObject.Type.STRING]}
                    actions={Gdk.DragAction.MOVE}
                    onMotion={() => Gdk.DragAction.MOVE}
                    onDrop={(value: GObject.Value, dropX: number, dropY: number) =>
                        handleCanvasDrop(value, dropX, dropY)
                    }
                />
                <GtkGestureClick
                    button={0}
                    onPressed={(_nPress: number, pressX: number, pressY: number, self: Gtk.GestureClick) => {
                        const event = self.getCurrentEvent();
                        if (event?.triggersContextMenu()) {
                            handleContextMenu(pressX, pressY);
                        }
                    }}
                />
                {items.map((item) => (
                    <x.FixedChild
                        key={item.id}
                        x={item.x}
                        y={item.y}
                        transform={createRotationTransform(item.angle + item.angleDelta)}
                    >
                        <GtkButton
                            ref={(ref) => {
                                if (ref) buttonRefs.current.set(item.id, ref);
                                else buttonRefs.current.delete(item.id);
                            }}
                            label={item.label}
                            cssClasses={cx(
                                itemStyle,
                                getItemStyleClass(item.style),
                                isDragging === item.id && css`opacity: 0.3;`,
                            )}
                        >
                            <GtkDragSource
                                onPrepare={(x: number, y: number) => {
                                    dragHotspotRef.current = { x, y };
                                    return createContentProvider(item.id);
                                }}
                                onDragBegin={() => {
                                    setDragIcon(item.id);
                                    bringToFront(item.id);
                                    setIsDragging(item.id);
                                }}
                                onDragEnd={() => setIsDragging(null)}
                                actions={Gdk.DragAction.MOVE}
                            />
                            <GtkDropTarget
                                types={[getGdkRgbaType(), GObject.Type.STRING]}
                                actions={Gdk.DragAction.COPY}
                                onMotion={() => Gdk.DragAction.COPY}
                                onDrop={(value: GObject.Value) => handleItemColorDrop(item.id, value)}
                            />
                            <GtkGestureRotate
                                onAngleChanged={handleRotateAngleChanged(item.id)}
                                onEnd={() => handleRotateEnd(item.id)}
                            />
                            <GtkGestureClick
                                onReleased={() => {
                                    bringToFront(item.id);
                                    toggleEditing(item.id);
                                }}
                            />
                        </GtkButton>
                    </x.FixedChild>
                ))}

                <x.FixedChild x={0} y={0}>
                    <GtkPopover
                        ref={contextMenuRef}
                        hasArrow={false}
                        pointingTo={
                            contextMenu
                                ? new Gdk.Rectangle({
                                      x: contextMenu.x,
                                      y: contextMenu.y,
                                      width: 1,
                                      height: 1,
                                  })
                                : undefined
                        }
                        autohide
                        onClosed={() => setContextMenu(null)}
                    >
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                            <GtkButton label="New" cssClasses={["flat"]} onClicked={handleAddItem} />
                            <GtkSeparator />
                            <GtkButton
                                label="Edit"
                                cssClasses={["flat"]}
                                sensitive={contextMenu?.itemId !== null}
                                onClicked={handleEditItem}
                            />
                            <GtkSeparator />
                            <GtkButton
                                label="Delete"
                                cssClasses={["flat"]}
                                sensitive={contextMenu?.itemId !== null}
                                onClicked={handleDeleteItem}
                            />
                        </GtkBox>
                    </GtkPopover>
                </x.FixedChild>

                {editingItem && (
                    <x.FixedChild
                        x={editingItem.x}
                        y={
                            editingItem.y +
                            ITEM_SIZE / 2 +
                            (ITEM_SIZE / 2) *
                                (Math.abs(Math.cos(((editingItem.angle + editingItem.angleDelta) * Math.PI) / 180)) +
                                    Math.abs(
                                        Math.sin(((editingItem.angle + editingItem.angleDelta) * Math.PI) / 180),
                                    )) +
                            10
                        }
                    >
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                            <GtkEntry
                                ref={(entry: Gtk.Entry | null) => {
                                    if (entry) entry.grabFocus();
                                }}
                                text={editingItem.label}
                                onChanged={(entry) => updateItemLabel(editingItem.id, entry.getText())}
                                widthChars={12}
                                onActivate={() => setEditState(null)}
                            />
                            <GtkScale
                                orientation={Gtk.Orientation.HORIZONTAL}
                                lower={0}
                                upper={360}
                                value={editingItem.angle % 360}
                                onValueChanged={(val) => updateItemAngle(editingItem.id, val)}
                                drawValue={false}
                            />
                        </GtkBox>
                    </x.FixedChild>
                )}

                {isDragging && (
                    <x.FixedChild x={20} y={20}>
                        <GtkBox
                            cssClasses={[
                                css`padding: 12px;`,
                                trashHovering
                                    ? css`background-color: alpha(@error_color, 0.2); border-radius: 12px;`
                                    : "",
                            ]}
                        >
                            <GtkDropTarget
                                types={[GObject.Type.STRING]}
                                actions={Gdk.DragAction.MOVE}
                                onEnter={() => {
                                    setTrashHovering(true);
                                    return Gdk.DragAction.MOVE;
                                }}
                                onLeave={() => setTrashHovering(false)}
                                onDrop={(value: GObject.Value) => handleTrashDrop(value)}
                            />
                            <GtkImage iconName="user-trash-symbolic" pixelSize={64} cssClasses={["error"]} />
                        </GtkBox>
                    </x.FixedChild>
                )}
            </GtkFixed>

            <GtkSeparator orientation={Gtk.Orientation.HORIZONTAL} />

            <GtkScrolledWindow
                hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                vscrollbarPolicy={Gtk.PolicyType.NEVER}
                minContentHeight={48}
            >
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={4} cssClasses={["linked"]}>
                    {SWATCH_COLORS.map((color) => (
                        <ColorSwatch key={color} color={color} />
                    ))}
                    <CssPatternSwatch cssClass={rainbow1Style} />
                    <CssPatternSwatch cssClass={rainbow2Style} />
                    <CssPatternSwatch cssClass={rainbow3Style} />
                </GtkBox>
            </GtkScrolledWindow>
        </GtkBox>
    );
};

export const dndDemo: Demo = {
    id: "dnd",
    title: "Drag-and-Drop",
    description: "Drag-and-drop with rotation gestures, context menu, and inline editing",
    keywords: [
        "drag",
        "drop",
        "dnd",
        "canvas",
        "fixed",
        "position",
        "rotation",
        "gesture",
        "transform",
        "GtkDragSource",
        "GtkDropTarget",
        "GtkGestureRotate",
        "GtkFixed",
    ],
    component: DndDemo,
    sourceCode,
    defaultWidth: 640,
    defaultHeight: 480,
};
