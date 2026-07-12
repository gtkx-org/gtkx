import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkDragSource, GtkDropTarget, GtkLabel } from "@gtkx/jsx/gtk";
import type { ComponentProps } from "react";
import { type Mock, vi } from "vitest";
import { render, screen } from "../src/index.js";

export interface RenderedClickButton {
    handleClick: Mock;
    button: Gtk.Widget;
}

export async function renderClickButton(label = "Click me"): Promise<RenderedClickButton> {
    const handleClick = vi.fn();
    await render(<GtkButton label={label} onClicked={handleClick} />);

    const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: label });
    return { handleClick, button };
}

export interface DragAndDropPairOptions {
    onDrop: ComponentProps<typeof GtkDropTarget>["onDrop"];
    sourceSensitive?: boolean;
    withDragSource?: boolean;
}

export interface RenderedDragAndDropPair {
    source: Gtk.Widget;
    target: Gtk.Widget;
}

export async function renderDragAndDropPair(options: DragAndDropPairOptions): Promise<RenderedDragAndDropPair> {
    await render(
        <GtkBox>
            <GtkLabel
                name="drag-source"
                label="Drag me"
                sensitive={options.sourceSensitive ?? true}
                controllers={
                    options.withDragSource === false ? undefined : <GtkDragSource actions={Gdk.DragAction.COPY} />
                }
            />
            <GtkLabel
                name="drop-target"
                label="Drop here"
                controllers={
                    <GtkDropTarget
                        types={[GObject.TYPE_STRING]}
                        actions={Gdk.DragAction.COPY}
                        onDrop={options.onDrop}
                    />
                }
            />
        </GtkBox>,
    );

    const source = await screen.findByName("drag-source");
    const target = await screen.findByName("drop-target");
    return { source, target };
}
