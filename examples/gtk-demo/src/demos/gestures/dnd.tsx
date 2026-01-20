import { css, cx } from "@gtkx/css";
import * as Gdk from "@gtkx/ffi/gdk";
import * as GObject from "@gtkx/ffi/gobject";
import * as Graphene from "@gtkx/ffi/graphene";
import * as Gsk from "@gtkx/ffi/gsk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkEntry, GtkFixed, GtkImage, GtkLabel, GtkPopover, GtkScale, x } from "@gtkx/react";
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

const ITEM_SIZE = 60;

interface CanvasItem {
    id: string;
    label: string;
    color: "accent" | "success" | "warning" | "error";
    x: number;
    y: number;
    angle: number;
    angleDelta: number;
}

interface ContextMenuState {
    x: number;
    y: number;
    itemId: string | null;
}

interface EditState {
    itemId: string;
    label: string;
    angle: number;
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

const DndDemo = () => {
    const [items, setItems] = useState<CanvasItem[]>([
        { id: "1", label: "A", color: "accent", x: 50, y: 50, angle: 0, angleDelta: 0 },
        { id: "2", label: "B", color: "success", x: 150, y: 80, angle: 0, angleDelta: 0 },
        { id: "3", label: "C", color: "warning", x: 250, y: 50, angle: 0, angleDelta: 0 },
    ]);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [editState, setEditState] = useState<EditState | null>(null);
    const [isDragging, setIsDragging] = useState<string | null>(null);
    const [trashHovering, setTrashHovering] = useState(false);

    const contextMenuRef = useRef<Gtk.Popover | null>(null);
    const editPopoverRef = useRef<Gtk.Popover | null>(null);

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
        (_nPress: number, x: number, y: number) => {
            const hitItem = items.find(
                (item) => x >= item.x && x <= item.x + ITEM_SIZE && y >= item.y && y <= item.y + ITEM_SIZE,
            );
            setContextMenu({ x, y, itemId: hitItem?.id ?? null });
            setTimeout(() => contextMenuRef.current?.popup(), 0);
        },
        [items],
    );

    const handleAddItem = useCallback(
        (color: CanvasItem["color"]) => {
            if (!contextMenu) return;
            const id = String(nextId++);
            const label = String.fromCharCode(65 + ((nextId - 1) % 26));
            setItems((prev) => [
                ...prev,
                {
                    id,
                    label,
                    color,
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
        const item = items.find((i) => i.id === contextMenu.itemId);
        if (item) {
            setEditState({ itemId: item.id, label: item.label, angle: item.angle });
            contextMenuRef.current?.popdown();
            setTimeout(() => editPopoverRef.current?.popup(), 0);
        }
    }, [contextMenu, items]);

    const handleDeleteItem = useCallback(() => {
        if (!contextMenu?.itemId) return;
        setItems((prev) => prev.filter((item) => item.id !== contextMenu.itemId));
        contextMenuRef.current?.popdown();
        setContextMenu(null);
    }, [contextMenu]);

    const handleEditSave = useCallback(() => {
        if (!editState) return;
        setItems((prev) =>
            prev.map((item) =>
                item.id === editState.itemId ? { ...item, label: editState.label, angle: editState.angle } : item,
            ),
        );
        editPopoverRef.current?.popdown();
        setEditState(null);
        setContextMenu(null);
    }, [editState]);

    const handleRotateAngleChanged = useCallback(
        (itemId: string) => (_angle: number, angleDelta: number) => {
            const angleDeltaDeg = (angleDelta * 180) / Math.PI;
            setItems((prev) =>
                prev.map((item) => (item.id === itemId ? { ...item, angleDelta: angleDeltaDeg } : item)),
            );
        },
        [],
    );

    const handleRotateEnd = useCallback(
        (itemId: string) => () => {
            setItems((prev) =>
                prev.map((item) =>
                    item.id === itemId ? { ...item, angle: item.angle + item.angleDelta, angleDelta: 0 } : item,
                ),
            );
        },
        [],
    );

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
                label="Drag items to reposition. Use two-finger rotation to rotate items. Right-click for context menu."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFixed
                widthRequest={500}
                heightRequest={400}
                cssClasses={[canvasStyle]}
                dropTypes={[GObject.Type.STRING]}
                onDropMotion={() => Gdk.DragAction.MOVE}
                onDrop={(value: GObject.Value, x: number, y: number) => handleCanvasDrop(value, x, y)}
                onPressed={(nPress, x, y) => {
                    if (nPress === 1) {
                        handleContextMenu(nPress, x, y);
                    }
                }}
            >
                {items.map((item) => (
                    <x.FixedChild
                        key={item.id}
                        x={item.x}
                        y={item.y}
                        transform={createRotationTransform(item.angle + item.angleDelta)}
                    >
                        <GtkButton
                            label={item.label}
                            cssClasses={[
                                cx(itemStyle, colorClasses[item.color], isDragging === item.id && "dim-label"),
                            ]}
                            onDragPrepare={() => createContentProvider(item.id)}
                            onDragBegin={() => setIsDragging(item.id)}
                            onDragEnd={() => setIsDragging(null)}
                            dragActions={Gdk.DragAction.MOVE}
                            onRotateAngleChanged={handleRotateAngleChanged(item.id)}
                            onRotateEnd={handleRotateEnd(item.id)}
                        />
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
                    <x.FixedChild x={editingItem.x} y={editingItem.y + ITEM_SIZE}>
                        <GtkPopover
                            ref={editPopoverRef}
                            hasArrow
                            autohide
                            onClosed={() => {
                                setEditState(null);
                                setContextMenu(null);
                            }}
                        >
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={12}
                                marginTop={6}
                                marginBottom={6}
                                marginStart={6}
                                marginEnd={6}
                            >
                                <GtkBox spacing={8}>
                                    <GtkLabel label="Label:" widthChars={8} xalign={0} />
                                    <GtkEntry
                                        text={editState?.label ?? ""}
                                        onChanged={(entry) =>
                                            setEditState((prev) => (prev ? { ...prev, label: entry.getText() } : null))
                                        }
                                        widthChars={10}
                                    />
                                </GtkBox>
                                <GtkBox spacing={8}>
                                    <GtkLabel label="Angle:" widthChars={8} xalign={0} />
                                    <GtkScale
                                        orientation={Gtk.Orientation.HORIZONTAL}
                                        lower={0}
                                        upper={360}
                                        value={editState?.angle ?? 0}
                                        onValueChanged={(val) =>
                                            setEditState((prev) => (prev ? { ...prev, angle: val } : null))
                                        }
                                        hexpand
                                        digits={0}
                                        drawValue
                                    />
                                </GtkBox>
                                <GtkButton label="Apply" cssClasses={["suggested-action"]} onClicked={handleEditSave} />
                            </GtkBox>
                        </GtkPopover>
                    </x.FixedChild>
                )}
            </GtkFixed>

            {isDragging && (
                <GtkBox
                    halign={Gtk.Align.CENTER}
                    cssClasses={[trashStyle, trashHovering ? trashActiveStyle : ""]}
                    dropTypes={[GObject.Type.STRING]}
                    onDropEnter={() => {
                        setTrashHovering(true);
                        return Gdk.DragAction.MOVE;
                    }}
                    onDropLeave={() => setTrashHovering(false)}
                    onDrop={(value: GObject.Value) => handleTrashDrop(value)}
                >
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
