import type { BoundQueries } from "@gtkx/testing";
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
import { render, within } from "@gtkx/testing";
import { type Mock, vi } from "vitest";

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

type ShortcutHostOptions = {
    trigger: Gtk.ShortcutTrigger;
    isSensitive?: boolean;
    isHandled?: boolean;
    phase?: Gtk.PropagationPhase;
    scope?: Gtk.ShortcutScope;
    children?: ReactNode;
    sibling?: ReactNode;
    treeControllers?: ReactNode;
};

type RenderedShortcutHost = {
    host: Gtk.Widget;
    findByName: BoundQueries["findByName"];
    onActivate: Mock<() => boolean>;
};

async function renderClickButton(label = "Click me"): Promise<RenderedClickButton> {
    const handleClick = vi.fn();
    const { container } = await render(<GtkButton label={label} onClicked={handleClick} />);
    const button = await within(container).findByRole(Gtk.AccessibleRole.BUTTON, { name: label });

    return { handleClick, button };
}

async function renderGesturedLabel(
    name: string,
    label: string,
    gesture: ReactNode,
    isSensitive = true,
): Promise<Gtk.Widget> {
    const { container } = await render(
        <GtkLabel name={name} sensitive={isSensitive} controllers={gesture}>
            {label}
        </GtkLabel>,
    );

    return within(container).findByName(name);
}

async function renderShortcutHost(options: ShortcutHostOptions): Promise<RenderedShortcutHost> {
    const onActivate = vi.fn(() => options.isHandled ?? true);

    const { container } = await render(
        <GtkBox name="tree" orientation={Gtk.Orientation.VERTICAL} controllers={options.treeControllers}>
            <GtkBox
                name="host"
                sensitive={options.isSensitive ?? true}
                controllers={(
                    <GtkShortcutController
                        propagationPhase={options.phase}
                        scope={options.scope}
                        shortcuts={(
                            <GtkShortcut trigger={options.trigger} action={Gtk.CallbackAction.new(onActivate)} />
                        )}
                    />
                )}
            >
                {options.children ?? <GtkLabel>anchor</GtkLabel>}
            </GtkBox>
            {options.sibling}
        </GtkBox>,
    );

    const { findByName } = within(container);

    return { host: await findByName("host"), findByName, onActivate };
}

async function renderDragAndDropPair(options: DragAndDropPairOptions): Promise<RenderedDragAndDropPair> {
    const { container } = await render(
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

    const { findByName } = within(container);
    const source = await findByName("drag-source");
    const target = await findByName("drop-target");

    return { source, target };
}

export {
    renderClickButton,
    renderDragAndDropPair,
    renderGesturedLabel,
    renderShortcutHost,
    type ShortcutHostOptions,
};
