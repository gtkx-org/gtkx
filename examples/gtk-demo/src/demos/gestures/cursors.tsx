import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel } from "@gtkx/react";
import { useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./cursors.tsx?raw";

const CURSOR_NAMES = [
    { name: "default", description: "Default arrow cursor" },
    { name: "pointer", description: "Hand pointer for clickable elements" },
    { name: "text", description: "I-beam for text selection" },
    { name: "crosshair", description: "Precision selection" },
    { name: "move", description: "Move/drag cursor" },
    { name: "wait", description: "Busy/loading cursor" },
    { name: "progress", description: "Background activity" },
    { name: "not-allowed", description: "Action not permitted" },
    { name: "help", description: "Help available" },
    { name: "grab", description: "Grabbable item" },
    { name: "grabbing", description: "Currently grabbing" },
    { name: "zoom-in", description: "Zoom in action" },
    { name: "zoom-out", description: "Zoom out action" },
    { name: "col-resize", description: "Column resize" },
    { name: "row-resize", description: "Row resize" },
    { name: "n-resize", description: "Resize north" },
    { name: "e-resize", description: "Resize east" },
    { name: "s-resize", description: "Resize south" },
    { name: "w-resize", description: "Resize west" },
    { name: "ne-resize", description: "Resize northeast" },
    { name: "nw-resize", description: "Resize northwest" },
    { name: "se-resize", description: "Resize southeast" },
    { name: "sw-resize", description: "Resize southwest" },
];

interface CursorBoxProps {
    cursorName: string;
    description: string;
    isActive: boolean;
}

const CursorBox = ({ cursorName, description, isActive }: CursorBoxProps) => {
    const boxRef = useRef<Gtk.Box | null>(null);

    useEffect(() => {
        const box = boxRef.current;
        if (!box) return;

        const cursor = new Gdk.Cursor(cursorName);
        box.setCursor(cursor);
    }, [cursorName]);

    return (
        <GtkBox
            ref={boxRef}
            orientation={Gtk.Orientation.VERTICAL}
            spacing={4}
            cssClasses={isActive ? ["card", "suggested-action"] : ["card"]}
            widthRequest={120}
            heightRequest={80}
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.CENTER}
            marginStart={8}
            marginEnd={8}
            marginTop={8}
            marginBottom={8}
        >
            <GtkLabel label={cursorName} cssClasses={["heading"]} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
            <GtkLabel
                label={description}
                cssClasses={["caption", "dim-label"]}
                halign={Gtk.Align.CENTER}
                wrap
                lines={2}
            />
        </GtkBox>
    );
};

const CursorsDemo = () => {
    const [activeCursor] = useState<string>("default");
    const [customCursor, setCustomCursor] = useState<string | null>(null);
    const previewRef = useRef<Gtk.Box | null>(null);

    useEffect(() => {
        const preview = previewRef.current;
        if (!preview) return;

        if (customCursor) {
            const cursor = new Gdk.Cursor(customCursor);
            preview.setCursor(cursor);
        } else {
            preview.setCursor(null);
        }
    }, [customCursor]);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Cursors" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GTK supports various cursor types that can be set on widgets using Gdk.Cursor. Hover over the boxes below to see different cursor styles."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Common Cursors">
                <GtkBox
                    spacing={8}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                    halign={Gtk.Align.CENTER}
                >
                    {CURSOR_NAMES.slice(0, 8).map((cursor) => (
                        <CursorBox
                            key={cursor.name}
                            cursorName={cursor.name}
                            description={cursor.description}
                            isActive={activeCursor === cursor.name}
                        />
                    ))}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Resize Cursors">
                <GtkBox
                    spacing={8}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                    halign={Gtk.Align.CENTER}
                >
                    {CURSOR_NAMES.slice(12, 23).map((cursor) => (
                        <CursorBox
                            key={cursor.name}
                            cursorName={cursor.name}
                            description={cursor.description}
                            isActive={activeCursor === cursor.name}
                        />
                    ))}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Cursor Preview Area">
                <GtkBox
                    ref={previewRef}
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                    heightRequest={150}
                    cssClasses={["card"]}
                    valign={Gtk.Align.CENTER}
                >
                    <GtkLabel
                        label={customCursor ? `Current: ${customCursor}` : "Select a cursor below"}
                        cssClasses={["title-4"]}
                        halign={Gtk.Align.CENTER}
                        valign={Gtk.Align.CENTER}
                        vexpand
                    />

                    <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
                        {["pointer", "crosshair", "move", "wait", "grab"].map((name) => (
                            <GtkButton
                                key={name}
                                label={name}
                                cssClasses={customCursor === name ? ["suggested-action"] : []}
                                onClicked={() => setCustomCursor(customCursor === name ? null : name)}
                            />
                        ))}
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Current Cursor">
                <GtkBox spacing={16} marginStart={16} marginEnd={16} marginTop={16} marginBottom={16}>
                    <GtkLabel label="Last hovered:" cssClasses={["dim-label"]} />
                    <GtkLabel label={activeCursor} cssClasses={["heading"]} />
                    <GtkLabel
                        label={CURSOR_NAMES.find((c) => c.name === activeCursor)?.description ?? ""}
                        cssClasses={["dim-label"]}
                        hexpand
                        halign={Gtk.Align.END}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkLabel
                label="Use widget.setCursor(new Gdk.Cursor('cursor-name')) to set a cursor. Pass null to reset to the default cursor."
                wrap
                cssClasses={["dim-label", "caption"]}
                halign={Gtk.Align.START}
            />
        </GtkBox>
    );
};

export const cursorsDemo: Demo = {
    id: "cursors",
    title: "Cursors",
    description: "Custom cursor themes and cursor types",
    keywords: ["cursor", "pointer", "mouse", "crosshair", "resize", "Gdk.Cursor"],
    component: CursorsDemo,
    sourceCode,
};
