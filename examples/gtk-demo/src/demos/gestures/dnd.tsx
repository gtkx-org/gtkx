import * as Gdk from "@gtkx/ffi/gdk";
import * as GObject from "@gtkx/ffi/gobject";
import { typeFromName } from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel } from "@gtkx/react";
import { useMemo, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./dnd.tsx?raw";

function createStringValue(str: string): GObject.Value {
    const stringType = typeFromName("gchararray");
    const value = new GObject.Value();
    value.init(stringType);
    value.setString(str);
    return value;
}

interface DraggableItemProps {
    label: string;
    color: string;
}

const DraggableItem = ({ label, color }: DraggableItemProps) => {
    const [isDragging, setIsDragging] = useState(false);

    return (
        <GtkButton
            label={label}
            cssClasses={[color, isDragging ? "dim-label" : ""]}
            onDragPrepare={() => Gdk.ContentProvider.newForValue(createStringValue(label))}
            onDragBegin={() => setIsDragging(true)}
            onDragEnd={() => setIsDragging(false)}
        />
    );
};

interface DroppedItem {
    id: number;
    label: string;
}

interface DropZoneProps {
    title: string;
    items: DroppedItem[];
    onDrop: (value: string) => void;
}

const DropZone = ({ title, items, onDrop }: DropZoneProps) => {
    const [isHovering, setIsHovering] = useState(false);
    const stringType = useMemo(() => typeFromName("gchararray"), []);

    return (
        <GtkFrame label={title}>
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={8}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
                vexpand
                cssClasses={isHovering ? ["accent"] : []}
                dropTypes={[stringType]}
                onDropEnter={() => {
                    setIsHovering(true);
                    return Gdk.DragAction.COPY;
                }}
                onDropLeave={() => setIsHovering(false)}
                onDrop={(value: GObject.Value) => {
                    setIsHovering(false);
                    const text = value.getString();
                    if (text) {
                        onDrop(text);
                    }
                    return true;
                }}
            >
                {items.length === 0 ? (
                    <GtkLabel label="Drop items here" cssClasses={["dim-label"]} vexpand valign={Gtk.Align.CENTER} />
                ) : (
                    items.map((item) => <GtkLabel key={item.id} label={item.label} />)
                )}
            </GtkBox>
        </GtkFrame>
    );
};

let nextId = 0;

const DndDemo = () => {
    const [droppedItems, setDroppedItems] = useState<DroppedItem[]>([]);

    const handleDrop = (value: string) => {
        setDroppedItems((prev) => [...prev, { id: nextId++, label: value }]);
    };

    const handleClear = () => {
        setDroppedItems([]);
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Drag and Drop" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GTKX provides declarative drag and drop through props. Use onDragPrepare, onDragBegin, onDragEnd for sources, and onDrop, onDropEnter, onDropLeave, dropTypes for targets."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Draggable Items">
                <GtkBox
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    homogeneous
                >
                    <DraggableItem label="Red Item" color="error" />
                    <DraggableItem label="Green Item" color="success" />
                    <DraggableItem label="Blue Item" color="accent" />
                </GtkBox>
            </GtkFrame>

            <DropZone title="Drop Zone" items={droppedItems} onDrop={handleDrop} />

            <GtkBox halign={Gtk.Align.END}>
                <GtkButton label="Clear" onClicked={handleClear} />
            </GtkBox>

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
                        label="The draggable items use these props:"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <GtkBox spacing={12}>
                            <GtkLabel label="onDragPrepare" widthChars={14} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Returns ContentProvider with drag data" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="onDragBegin" widthChars={14} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Called when drag starts" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="onDragEnd" widthChars={14} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Called when drag ends" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                    </GtkBox>

                    <GtkLabel
                        label="The drop zone uses these props:"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                        marginTop={12}
                    />

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <GtkBox spacing={12}>
                            <GtkLabel label="dropTypes" widthChars={14} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Array of accepted GTypes" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="onDropEnter" widthChars={14} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Called when drag enters zone" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="onDropLeave" widthChars={14} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Called when drag leaves zone" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="onDrop" widthChars={14} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Called when item is dropped" wrap cssClasses={["dim-label"]} />
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
    description: "Declarative drag and drop with onDragPrepare, onDrop, and related props",
    keywords: ["drag", "drop", "dnd", "GtkDragSource", "GtkDropTarget", "transfer", "move", "copy"],
    component: DndDemo,
    sourceCode,
};
