import type { ComponentProps, ReactNode } from "react";
import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkDragSource,
    GtkDropTarget,
    GtkLabel,
    GtkShortcut,
    GtkShortcutController,
} from "@gtkx/jsx/gtk";
import { type Mock, vi } from "vitest";
import { render, screen } from "../src/index.js";

type RenderedClickButton = {
    handleClick: Mock;
    button: Gtk.Widget;
};

type DragAndDropPairOptions = {
    onDrop: ComponentProps<typeof GtkDropTarget>["onDrop"];
    isSourceSensitive?: boolean;
    hasDragSource?: boolean;
};

type RenderedDragAndDropPair = {
    source: Gtk.Widget;
    target: Gtk.Widget;
};

async function renderClickButton(label = "Click me"): Promise<RenderedClickButton> {
    const handleClick = vi.fn();
    await render(<GtkButton label={label} onClicked={handleClick} />);
    const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: label });

    return { handleClick, button };
}

async function renderGesturedLabel(
    name: string,
    label: string,
    gesture: ReactNode,
    isSensitive = true,
): Promise<Gtk.Widget> {
    await render(
        <GtkLabel name={name} sensitive={isSensitive} controllers={gesture}>
            {label}
        </GtkLabel>,
    );

    return screen.findByName(name);
}

async function renderShortcutHost(
    trigger: Gtk.ShortcutTrigger,
    didActivate: () => boolean,
    isSensitive = true,
): Promise<Gtk.Widget> {
    await render(
        <GtkBox
            name="host"
            sensitive={isSensitive}
            controllers={(
                <GtkShortcutController
                    scope={Gtk.ShortcutScope.GLOBAL}
                    shortcuts={<GtkShortcut trigger={trigger} action={Gtk.CallbackAction.new(didActivate)} />}
                />
            )}
        >
            <GtkLabel>anchor</GtkLabel>
        </GtkBox>,
    );

    return screen.findByName("host");
}

async function renderDragAndDropPair(options: DragAndDropPairOptions): Promise<RenderedDragAndDropPair> {
    await render(
        <GtkBox>
            <GtkLabel
                name="drag-source"
                sensitive={options.isSourceSensitive ?? true}
                controllers={
                    options.hasDragSource === false ? undefined : <GtkDragSource actions={Gdk.DragAction.COPY} />
                }
            >
                Drag me
            </GtkLabel>
            <GtkLabel
                name="drop-target"
                controllers={(
                    <GtkDropTarget
                        types={[GObject.TYPE_STRING]}
                        actions={Gdk.DragAction.COPY}
                        onDrop={options.onDrop}
                    />
                )}
            >
                Drop here
            </GtkLabel>
        </GtkBox>,
    );

    const source = await screen.findByName("drag-source");
    const target = await screen.findByName("drop-target");

    return { source, target };
}

export {
    renderClickButton,
    renderDragAndDropPair,
    renderGesturedLabel,
    renderShortcutHost,
};
