import type * as GObject from "@gtkx/gi/gobject";
import type { ReactElement, ReactNode, RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkColumnView, GtkGridView, GtkListView, GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";

type ViewOptions = {
    isSingleClickActivating?: boolean;
    onActivate?: () => void;
};

type ListViewOptions = ViewOptions & {
    model: ReactElement;
    factory?: ReactElement;
};

const ITEM_NAMES = ["alpha", "beta", "gamma"];
const BUTTON_LABEL = "Open";

const setupChild = (object: GObject.Object, createChild: () => Gtk.Widget): void => {
    if (object instanceof Gtk.ListItem) {
        object.setChild(createChild());
    }
};

const setupListItem = (object: GObject.Object): void => {
    setupChild(object, () => new Gtk.Label());
};

const setupButtonItem = (object: GObject.Object): void => {
    setupChild(object, () => new Gtk.Button({ label: BUTTON_LABEL }));
};

const getItemChild = (object: GObject.Object): Gtk.Widget | null =>
    object instanceof Gtk.ListItem ? object.getChild() : null;

const bindListItem = (object: GObject.Object): void => {
    const child = getItemChild(object);
    const item = object instanceof Gtk.ListItem ? object.getItem() : null;

    if (child instanceof Gtk.Label && item instanceof Gtk.StringObject) {
        child.setLabel(item.getString());
    }
};

const itemFactory = (): ReactElement => <GtkSignalListItemFactory onSetup={setupListItem} onBind={bindListItem} />;

const buttonFactory = (onClicked: () => void): ReactElement => {
    const bindButtonItem = (object: GObject.Object): void => {
        const child = getItemChild(object);

        if (child instanceof Gtk.Button) {
            child.connect("clicked", onClicked);
        }
    };

    return <GtkSignalListItemFactory onSetup={setupButtonItem} onBind={bindButtonItem} />;
};

const viewProps = (options: ViewOptions): Record<string, unknown> => ({
    singleClickActivate: options.isSingleClickActivating ?? false,
    ...(options.onActivate !== undefined && { onActivate: options.onActivate }),
});

const renderListView = async (options: ListViewOptions): Promise<RefObject<Gtk.ListView | null>> => {
    const ref = createRef<Gtk.ListView>();

    await render(
        <GtkListView
            ref={ref}
            model={options.model}
            factory={options.factory ?? itemFactory()}
            {...viewProps(options)}
        />,
    );

    return ref;
};

const renderGridView = async (model: ReactElement): Promise<RefObject<Gtk.GridView | null>> => {
    const ref = createRef<Gtk.GridView>();
    await render(<GtkGridView ref={ref} model={model} factory={itemFactory()} />);

    return ref;
};

const renderColumnView = async (
    model: ReactElement,
    columns: ReactNode,
    options: ViewOptions = {},
): Promise<RefObject<Gtk.ColumnView | null>> => {
    const ref = createRef<Gtk.ColumnView>();

    await render(
        <GtkColumnView ref={ref} model={model} {...viewProps(options)}>
            {columns}
        </GtkColumnView>,
    );

    return ref;
};

export { BUTTON_LABEL, ITEM_NAMES, buttonFactory, itemFactory, renderColumnView, renderGridView, renderListView };
