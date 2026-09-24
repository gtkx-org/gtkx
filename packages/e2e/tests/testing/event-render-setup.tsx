import type { BoundQueries } from "@gtkx/testing";
import type { ComponentProps, ReactNode } from "react";
import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkCallbackAction,
    GtkDragSource,
    GtkDropTarget,
    GtkLabel,
    GtkShortcut,
    GtkShortcutController,
} from "@gtkx/jsx/gtk";
import { render, within } from "@gtkx/testing";

type CallCounter = {
    count: number;
    callback: () => void;
};

type ReturningCallCounter<Result> = {
    count: number;
    callback: () => Result;
};

const callCounter = (): CallCounter => {
    const counter: CallCounter = {
        count: 0,
        callback: () => {
            counter.count += 1;
        },
    };

    return counter;
};

const returningCallCounter = <Result,>(result: Result): ReturningCallCounter<Result> => {
    const counter: ReturningCallCounter<Result> = {
        count: 0,
        callback: () => {
            counter.count += 1;

            return result;
        },
    };

    return counter;
};

type RenderedClickButton = {
    clicks: CallCounter;
    button: Gtk.Widget;
};

type DragAndDropPairOptions = {
    onDrop: ComponentProps<typeof GtkDropTarget>["onDrop"];
    onDragBegin?: ComponentProps<typeof GtkDragSource>["onDragBegin"];
    onDragEnd?: ComponentProps<typeof GtkDragSource>["onDragEnd"];
    onPrepare?: ComponentProps<typeof GtkDragSource>["onPrepare"];
    content?: ComponentProps<typeof GtkDragSource>["content"];
    types?: ComponentProps<typeof GtkDropTarget>["types"];
    isSourceSensitive?: boolean;
    hasDragSource?: boolean;
};

type RenderedDragAndDropPair = {
    source: Gtk.Widget;
    target: Gtk.Widget;
};

type ShortcutHostOptions = {
    trigger: ComponentProps<typeof GtkShortcut>["trigger"];
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
    activations: ReturningCallCounter<boolean>;
};

async function renderClickButton(label = "Click me"): Promise<RenderedClickButton> {
    const clicks = callCounter();
    const { container } = await render(<GtkButton label={label} onClicked={clicks.callback} />);
    const button = await within(container).findByRole(Gtk.AccessibleRole.BUTTON, { name: label });

    return { clicks, button };
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
    const activations = returningCallCounter(options.isHandled ?? true);

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
                            <GtkShortcut
                                trigger={options.trigger}
                                action={<GtkCallbackAction callback={activations.callback} />}
                            />
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

    return { host: await findByName("host"), findByName, activations };
}

async function renderDragAndDropPair(options: DragAndDropPairOptions): Promise<RenderedDragAndDropPair> {
    const { container } = await render(
        <GtkBox>
            <GtkLabel
                name="drag-source"
                sensitive={options.isSourceSensitive ?? true}
                controllers={
                    options.hasDragSource === false
                        ? undefined
                        : (
                                <GtkDragSource
                                    actions={Gdk.DragAction.COPY}
                                    onDragBegin={options.onDragBegin}
                                    onDragEnd={options.onDragEnd}
                                    onPrepare={options.onPrepare}
                                    content={options.content}
                                />
                            )
                }
            >
                Drag me
            </GtkLabel>
            <GtkLabel
                name="drop-target"
                controllers={(
                    <GtkDropTarget
                        types={options.types ?? [GObject.TYPE_STRING]}
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
    callCounter,
    renderClickButton,
    renderDragAndDropPair,
    renderGesturedLabel,
    renderShortcutHost,
    returningCallCounter,
    type CallCounter,
    type ShortcutHostOptions,
};
