import { css, cx } from "@gtkx/css";
import * as Gdk from "@gtkx/ffi/gdk";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFixed, GtkFrame, GtkImage, GtkLabel, x } from "@gtkx/react";
import { useCallback, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./dnd.tsx?raw";

const canvasStyle = css`
    background: linear-gradient(135deg, alpha(@accent_color, 0.03), alpha(@accent_color, 0.01));
    border-radius: 12px;
    min-height: 300px;
`;

const itemStyle = css`
    min-width: 60px;
    min-height: 60px;
    border-radius: 8px;
    font-size: 18px;
    font-weight: bold;
`;

const trashZoneStyle = css`
    background-color: alpha(@error_color, 0.1);
    border: 2px dashed @error_color;
    border-radius: 12px;
    min-height: 80px;
`;

const trashZoneActiveStyle = css`
    background-color: alpha(@error_color, 0.3);
    border: 2px solid @error_color;
`;

const paletteItemStyle = css`
    min-width: 40px;
    min-height: 40px;
    border-radius: 6px;
    font-weight: bold;
`;

const selectedItemStyle = css`
    outline: 3px solid @accent_color;
    outline-offset: 2px;
`;

interface CanvasItem {
    id: string;
    label: string;
    color: "accent" | "success" | "warning" | "error";
    x: number;
    y: number;
}

const colorClasses: Record<string, string> = {
    accent: css`background-color: @accent_bg_color; color: @accent_fg_color;`,
    success: css`background-color: @success_bg_color; color: @success_fg_color;`,
    warning: css`background-color: @warning_bg_color; color: @warning_fg_color;`,
    error: css`background-color: @error_bg_color; color: @error_fg_color;`,
};

let nextId = 1;

const DndDemo = () => {
    const [items, setItems] = useState<CanvasItem[]>([
        { id: "1", label: "A", color: "accent", x: 50, y: 50 },
        { id: "2", label: "B", color: "success", x: 150, y: 80 },
        { id: "3", label: "C", color: "warning", x: 250, y: 50 },
    ]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [trashHovering, setTrashHovering] = useState(false);
    const [isDragging, setIsDragging] = useState<string | null>(null);

    const selectedItem = items.find((item) => item.id === selectedId);

    const createContentProvider = useCallback((itemId: string) => {
        return Gdk.ContentProvider.newForValue(GObject.Value.newFromString(itemId));
    }, []);

    const handleCanvasDrop = useCallback((value: GObject.Value, x: number, y: number) => {
        const itemId = value.getString();
        if (itemId) {
            setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, x: x - 30, y: y - 30 } : item)));
        }
        return true;
    }, []);

    const handleTrashDrop = useCallback((value: GObject.Value) => {
        const itemId = value.getString();
        if (itemId) {
            setItems((prev) => prev.filter((item) => item.id !== itemId));
            setSelectedId((prev) => (prev === itemId ? null : prev));
        }
        setTrashHovering(false);
        return true;
    }, []);

    const addNewItem = useCallback((color: CanvasItem["color"]) => {
        const id = String(nextId++);
        const label = String.fromCharCode(65 + (nextId % 26));
        setItems((prev) => [...prev, { id, label, color, x: 100 + Math.random() * 150, y: 100 + Math.random() * 100 }]);
    }, []);

    const deleteItem = useCallback((itemId: string) => {
        setItems((prev) => prev.filter((item) => item.id !== itemId));
        setSelectedId((prev) => (prev === itemId ? null : prev));
    }, []);

    const duplicateItem = useCallback(
        (itemId: string) => {
            const original = items.find((item) => item.id === itemId);
            if (original) {
                const id = String(nextId++);
                setItems((prev) => [...prev, { ...original, id, x: original.x + 30, y: original.y + 30 }]);
            }
        },
        [items],
    );

    const bringToFront = useCallback((itemId: string) => {
        setItems((prev) => {
            const item = prev.find((i) => i.id === itemId);
            if (!item) return prev;
            return [...prev.filter((i) => i.id !== itemId), item];
        });
    }, []);

    const sendToBack = useCallback((itemId: string) => {
        setItems((prev) => {
            const item = prev.find((i) => i.id === itemId);
            if (!item) return prev;
            return [item, ...prev.filter((i) => i.id !== itemId)];
        });
    }, []);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Drag-and-Drop" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Drag items around the canvas to reposition them. Drag to the trash zone to delete. Click items to select and use the controls below."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Item Palette">
                <GtkBox spacing={12} marginTop={12} marginBottom={12} marginStart={12} marginEnd={12}>
                    <GtkLabel label="Add new item:" cssClasses={["dim-label"]} />
                    <GtkButton
                        onClicked={() => addNewItem("accent")}
                        cssClasses={[cx(paletteItemStyle, colorClasses.accent)]}
                    >
                        <GtkLabel label="+" />
                    </GtkButton>
                    <GtkButton
                        onClicked={() => addNewItem("success")}
                        cssClasses={[cx(paletteItemStyle, colorClasses.success)]}
                    >
                        <GtkLabel label="+" />
                    </GtkButton>
                    <GtkButton
                        onClicked={() => addNewItem("warning")}
                        cssClasses={[cx(paletteItemStyle, colorClasses.warning)]}
                    >
                        <GtkLabel label="+" />
                    </GtkButton>
                    <GtkButton
                        onClicked={() => addNewItem("error")}
                        cssClasses={[cx(paletteItemStyle, colorClasses.error)]}
                    >
                        <GtkLabel label="+" />
                    </GtkButton>
                    <GtkLabel
                        label={`${items.length} items on canvas`}
                        cssClasses={["dim-label", "caption"]}
                        hexpand
                        halign={Gtk.Align.END}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Canvas">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkFixed
                        widthRequest={500}
                        heightRequest={300}
                        cssClasses={[canvasStyle]}
                        dropTypes={[GObject.Type.STRING]}
                        onDropMotion={() => Gdk.DragAction.MOVE}
                        onDrop={(value: GObject.Value, x: number, y: number) => handleCanvasDrop(value, x, y)}
                    >
                        {items.map((item) => (
                            <x.FixedChild key={item.id} x={item.x} y={item.y}>
                                <GtkButton
                                    label={item.label}
                                    cssClasses={[
                                        cx(
                                            itemStyle,
                                            colorClasses[item.color],
                                            selectedId === item.id && selectedItemStyle,
                                            isDragging === item.id && "dim-label",
                                        ),
                                    ]}
                                    onClicked={() => setSelectedId(item.id)}
                                    onDragPrepare={() => createContentProvider(item.id)}
                                    onDragBegin={() => setIsDragging(item.id)}
                                    onDragEnd={() => setIsDragging(null)}
                                    dragActions={Gdk.DragAction.MOVE}
                                />
                            </x.FixedChild>
                        ))}
                    </GtkFixed>

                    {items.length === 0 && (
                        <GtkLabel
                            label="Canvas is empty. Add items from the palette above."
                            cssClasses={["dim-label"]}
                            halign={Gtk.Align.CENTER}
                        />
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Trash Zone">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    cssClasses={[trashZoneStyle, trashHovering ? trashZoneActiveStyle : ""]}
                    dropTypes={[GObject.Type.STRING]}
                    onDropEnter={() => {
                        setTrashHovering(true);
                        return Gdk.DragAction.MOVE;
                    }}
                    onDropLeave={() => setTrashHovering(false)}
                    onDrop={(value: GObject.Value) => handleTrashDrop(value)}
                    valign={Gtk.Align.CENTER}
                    halign={Gtk.Align.CENTER}
                    hexpand
                >
                    <GtkImage
                        iconName={trashHovering ? "user-trash-full-symbolic" : "user-trash-symbolic"}
                        pixelSize={32}
                        cssClasses={["error"]}
                    />
                    <GtkLabel
                        label={trashHovering ? "Release to delete" : "Drop here to delete"}
                        cssClasses={["dim-label"]}
                    />
                </GtkBox>
            </GtkFrame>

            {selectedItem && (
                <GtkFrame label={`Selected: ${selectedItem.label}`}>
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={12}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <GtkBox spacing={8}>
                            <GtkButton
                                label="Delete"
                                cssClasses={["destructive-action"]}
                                onClicked={() => deleteItem(selectedItem.id)}
                            />
                            <GtkButton label="Duplicate" onClicked={() => duplicateItem(selectedItem.id)} />
                            <GtkButton label="Bring to Front" onClicked={() => bringToFront(selectedItem.id)} />
                            <GtkButton label="Send to Back" onClicked={() => sendToBack(selectedItem.id)} />
                        </GtkBox>

                        <GtkLabel
                            label={`Position: (${Math.round(selectedItem.x)}, ${Math.round(selectedItem.y)})`}
                            cssClasses={["monospace", "caption", "dim-label"]}
                            halign={Gtk.Align.START}
                        />
                    </GtkBox>
                </GtkFrame>
            )}

            <GtkFrame label="How It Works">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="This demo uses GtkFixed with drag-and-drop to create a canvas where items can be freely positioned."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <GtkBox spacing={12}>
                            <GtkLabel label="GtkFixed" widthChars={16} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Container for absolute positioning" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="x.FixedChild" widthChars={16} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Wrapper with x and y position props" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="onDragPrepare" widthChars={16} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Returns ContentProvider with item ID" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="dropTypes" widthChars={16} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Accepted GObject types for drop" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="onDrop" widthChars={16} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Receives value and drop coordinates" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const dndDemo: Demo = {
    id: "dnd",
    title: "Drag-and-Drop",
    description: "Drag-and-drop with GtkFixed canvas, free positioning, and trash zone",
    keywords: [
        "drag",
        "drop",
        "dnd",
        "canvas",
        "fixed",
        "position",
        "trash",
        "GtkDragSource",
        "GtkDropTarget",
        "GtkFixed",
    ],
    component: DndDemo,
    sourceCode,
};
