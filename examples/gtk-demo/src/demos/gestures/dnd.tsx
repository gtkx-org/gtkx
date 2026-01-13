import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkLabel } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./dnd.tsx?raw";

const DndDemo = () => {
    const [_dropHistory, setDropHistory] = useState<string[]>([]);
    const [_isDragging, _setIsDragging] = useState(false);
    const [_lastDropLocation, _setLastDropLocation] = useState<{
        x: number;
        y: number;
    } | null>(null);

    void setDropHistory;

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Drag and Drop" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GTK4 provides drag and drop through GtkDragSource and GtkDropTarget event controllers. These allow transferring data between widgets or applications."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="How Drag and Drop Works">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Drag and drop in GTK4 uses event controllers:"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                        <GtkBox spacing={12}>
                            <GtkLabel label="GtkDragSource" widthChars={16} xalign={0} cssClasses={["heading"]} />
                            <GtkLabel label="Makes a widget draggable" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="GtkDropTarget" widthChars={16} xalign={0} cssClasses={["heading"]} />
                            <GtkLabel label="Makes a widget accept drops" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="ContentProvider" widthChars={16} xalign={0} cssClasses={["heading"]} />
                            <GtkLabel label="Carries the dragged data" cssClasses={["dim-label"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="DragSource Signals">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="GtkDragSource emits these signals during a drag operation:"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <GtkBox spacing={12}>
                            <GtkLabel label="prepare" widthChars={12} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel
                                label="Called to prepare the ContentProvider before drag starts"
                                wrap
                                cssClasses={["dim-label"]}
                            />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="drag-begin" widthChars={12} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Emitted when the drag operation starts" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="drag-end" widthChars={12} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel
                                label="Emitted when the drag is finished or cancelled"
                                wrap
                                cssClasses={["dim-label"]}
                            />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="drag-cancel" widthChars={12} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Emitted when the drag is cancelled" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="DropTarget Signals">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="GtkDropTarget emits these signals when something is dragged over it:"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <GtkBox spacing={12}>
                            <GtkLabel label="accept" widthChars={10} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Return true to accept the incoming drop" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="enter" widthChars={10} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Cursor entered the drop target" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="motion" widthChars={10} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Cursor moved within the drop target" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="leave" widthChars={10} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Cursor left the drop target" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="drop" widthChars={10} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Data was dropped, return true to accept" wrap cssClasses={["dim-label"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Drag Actions">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Drag operations can have different actions that determine what happens to the source data:"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <GtkBox spacing={12}>
                            <GtkLabel label="GDK_ACTION_COPY" widthChars={18} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Copy the data (default)" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="GDK_ACTION_MOVE" widthChars={18} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Move the data (delete from source)" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="GDK_ACTION_LINK" widthChars={18} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Create a link/reference to the data" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="GDK_ACTION_ASK" widthChars={18} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Ask the user what to do" cssClasses={["dim-label"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Implementation Note">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Drag and drop in GTKX requires adding event controllers to widgets programmatically. This is typically done using refs and useEffect:"
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkLabel
                        label={`// Example setup
const widgetRef = useRef<Gtk.Widget | null>(null);

useEffect(() => {
 if (!widgetRef.current) return;

 // Create drag source
 const dragSource = new Gtk.DragSource();
 dragSource.setActions(Gdk.DragAction.COPY);

 dragSource.connect("prepare", () => {
 return Gdk.ContentProvider.newForValue("data");
 });

 widgetRef.current.addController(dragSource);
}, []);`}
                        cssClasses={["monospace"]}
                        halign={Gtk.Align.START}
                        wrap
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Tips">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="1. Use GtkDropTarget for simple cases where you just need to accept data."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkLabel
                        label="2. Use GtkDropTargetAsync for complex cases requiring async data loading."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkLabel
                        label="3. Set a drag icon using dragSource.setIcon() for better UX."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkLabel
                        label="4. Handle GDK_ACTION_MOVE carefully - delete source data only in drag-end."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const dndDemo: Demo = {
    id: "dnd",
    title: "Drag and Drop",
    description: "Drag and drop with GtkDragSource and GtkDropTarget",
    keywords: ["drag", "drop", "dnd", "GtkDragSource", "GtkDropTarget", "transfer", "move", "copy"],
    component: DndDemo,
    sourceCode,
};
