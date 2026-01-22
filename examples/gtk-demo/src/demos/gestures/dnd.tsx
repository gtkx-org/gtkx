import { css, cx, injectGlobal } from "@gtkx/css";
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
    GtkLabel,
    GtkPopover,
    GtkScale,
    GtkScrolledWindow,
    GtkSeparator,
    x,
} from "@gtkx/react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./dnd.tsx?raw";

const canvasStyle = css`
    background: linear-gradient(135deg, alpha(@accent_color, 0.03), alpha(@accent_color, 0.01));
    border-radius: 12px;
    min-height: 400px;
`;

const itemStyle = css`
    min-width: 60px;
    min-height: 60px;
    border-radius: 8px;
    font-size: 18px;
    font-weight: bold;
`;

const trashStyle = css`
    padding: 12px;
`;

const trashActiveStyle = css`
    background-color: alpha(@error_color, 0.2);
    border-radius: 12px;
`;

const colorClasses = {
    accent: css`background-color: @accent_bg_color; color: @accent_fg_color;`,
    success: css`background-color: @success_bg_color; color: @success_fg_color;`,
    warning: css`background-color: @warning_bg_color; color: @warning_fg_color;`,
    error: css`background-color: @error_bg_color; color: @error_fg_color;`,
} as const;

const swatchStyle = css`
    min-width: 32px;
    min-height: 32px;
    border-radius: 4px;
`;

injectGlobal`
    .rainbow1 {
        background: linear-gradient(140deg, red, orange, yellow, green, blue, purple);
    }

    .rainbow2 {
        animation: rainbow2 1s infinite linear;
    }

    @keyframes rainbow2 {
        0% { background: linear-gradient(0deg, red, orange, yellow, green, blue, purple); }
        25% { background: linear-gradient(90deg, red, orange, yellow, green, blue, purple); }
        50% { background: linear-gradient(180deg, red, orange, yellow, green, blue, purple); }
        75% { background: linear-gradient(270deg, red, orange, yellow, green, blue, purple); }
        100% { background: linear-gradient(360deg, red, orange, yellow, green, blue, purple); }
    }

    .rainbow3 {
        animation: rainbow3 1s infinite linear;
    }

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

type ItemStyle =
    | { type: "preset"; color: "accent" | "success" | "warning" | "error" }
    | { type: "rgba"; cssColor: string }
    | { type: "cssClass"; className: string };

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

let nextId = 4;

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
        <GtkBox cssClasses={[swatchStyle, dynamicStyle]} tooltipText={color}>
            <GtkDragSource onPrepare={createColorProvider} actions={Gdk.DragAction.COPY} />
        </GtkBox>
    );
}

function CssPatternSwatch({ cssClass }: { cssClass: string }) {
    const createClassProvider = useCallback(() => {
        return Gdk.ContentProvider.newForValue(GObject.Value.newFromString(cssClass));
    }, [cssClass]);

    return (
        <GtkBox cssClasses={[swatchStyle, cssClass]} tooltipText={cssClass}>
            <GtkDragSource onPrepare={createClassProvider} actions={Gdk.DragAction.COPY} />
        </GtkBox>
    );
}

function getItemStyleClass(style: ItemStyle): string {
    if (style.type === "preset") {
        return colorClasses[style.color];
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

const DndDemo = () => {
    const [items, setItems] = useState<CanvasItem[]>([
        { id: "1", label: "Item 1", style: { type: "preset", color: "accent" }, x: 40, y: 40, angle: 0, angleDelta: 0 },
        {
            id: "2",
            label: "Item 2",
            style: { type: "preset", color: "success" },
            x: 190,
            y: 140,
            angle: 0,
            angleDelta: 0,
        },
        {
            id: "3",
            label: "Item 3",
            style: { type: "preset", color: "warning" },
            x: 340,
            y: 240,
            angle: 0,
            angleDelta: 0,
        },
    ]);
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
            setItems((prev) =>
                prev.map((item) =>
                    item.id === itemId ? { ...item, x: x - ITEM_SIZE / 2, y: y - ITEM_SIZE / 2 } : item,
                ),
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

    const handleAddItem = useCallback(
        (presetColor: "accent" | "success" | "warning" | "error") => {
            if (!contextMenu) return;
            const id = String(nextId);
            const label = `Item ${nextId}`;
            nextId++;
            setItems((prev) => [
                ...prev,
                {
                    id,
                    label,
                    style: { type: "preset", color: presetColor },
                    x: contextMenu.x - ITEM_SIZE / 2,
                    y: contextMenu.y - ITEM_SIZE / 2,
                    angle: 0,
                    angleDelta: 0,
                },
            ]);
            contextMenuRef.current?.popdown();
            setContextMenu(null);
        },
        [contextMenu],
    );

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
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={12}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Drag-and-Drop" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Drag items to reposition. Click to edit. Use two-finger rotation to rotate items. Right-click for context menu. Drag colors from the palette onto items."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFixed hexpand vexpand cssClasses={[canvasStyle]}>
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
                                isDragging === item.id && "dim-label",
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
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                            <GtkLabel label="New Item" cssClasses={["dim-label", "caption"]} halign={Gtk.Align.START} />
                            <GtkBox spacing={6}>
                                <GtkButton
                                    cssClasses={["flat", colorClasses.accent]}
                                    onClicked={() => handleAddItem("accent")}
                                >
                                    <GtkLabel label="+" />
                                </GtkButton>
                                <GtkButton
                                    cssClasses={["flat", colorClasses.success]}
                                    onClicked={() => handleAddItem("success")}
                                >
                                    <GtkLabel label="+" />
                                </GtkButton>
                                <GtkButton
                                    cssClasses={["flat", colorClasses.warning]}
                                    onClicked={() => handleAddItem("warning")}
                                >
                                    <GtkLabel label="+" />
                                </GtkButton>
                                <GtkButton
                                    cssClasses={["flat", colorClasses.error]}
                                    onClicked={() => handleAddItem("error")}
                                >
                                    <GtkLabel label="+" />
                                </GtkButton>
                            </GtkBox>
                            {contextMenu?.itemId && (
                                <>
                                    <GtkBox cssClasses={["separator"]} />
                                    <GtkButton label="Edit" cssClasses={["flat"]} onClicked={handleEditItem} />
                                    <GtkButton
                                        label="Delete"
                                        cssClasses={["flat", "destructive-action"]}
                                        onClicked={handleDeleteItem}
                                    />
                                </>
                            )}
                        </GtkBox>
                    </GtkPopover>
                </x.FixedChild>

                {editingItem && (
                    <x.FixedChild x={editingItem.x} y={editingItem.y + ITEM_SIZE + 10}>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                            <GtkEntry
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
                    <CssPatternSwatch cssClass="rainbow1" />
                    <CssPatternSwatch cssClass="rainbow2" />
                    <CssPatternSwatch cssClass="rainbow3" />
                </GtkBox>
            </GtkScrolledWindow>

            {isDragging && (
                <GtkBox halign={Gtk.Align.CENTER} cssClasses={[trashStyle, trashHovering ? trashActiveStyle : ""]}>
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
                    <GtkImage
                        iconName={trashHovering ? "user-trash-full-symbolic" : "user-trash-symbolic"}
                        pixelSize={48}
                        cssClasses={["error"]}
                    />
                </GtkBox>
            )}
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
};
