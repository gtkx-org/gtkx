import type * as GObject from "@gtkx/gi/gobject";
import type { ReactElement, ReactNode, RefObject } from "react";
import { ListItemFactory as GtkxListItemFactory } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkColumnView, GtkGridView, GtkLabel, GtkListView } from "@gtkx/jsx/gtk";
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

type ItemRenderer = (item: GObject.Object) => ReactNode;

const ItemFactory = ({ renderItem }: { renderItem: ItemRenderer }): ReactNode => (
    <GtkxListItemFactory<GObject.Object> renderItem={({ item }) => renderItem(item)} />
);

const renderLabel = (item: GObject.Object): ReactNode => (
    item instanceof Gtk.StringObject ? <GtkLabel>{item.getString()}</GtkLabel> : null
);

const renderButton = (item: GObject.Object, onClicked: (name: string) => void): ReactNode => (
    item instanceof Gtk.StringObject
        ? (
                <GtkButton
                    label={BUTTON_LABEL}
                    onClicked={() => {
                        onClicked(item.getString());
                    }}
                />
            )
        : null
);

const itemFactory = (): ReactElement => <ItemFactory renderItem={renderLabel} />;

const buttonFactory = (onClicked: (name: string) => void): ReactElement => (
    <ItemFactory renderItem={(item) => renderButton(item, onClicked)} />
);

const renderListView = async (options: ListViewOptions): Promise<RefObject<Gtk.ListView | null>> => {
    const ref = createRef<Gtk.ListView>();

    await render(
        <GtkListView
            ref={ref}
            model={options.model}
            factory={options.factory ?? itemFactory()}
            singleClickActivate={options.isSingleClickActivating ?? false}
            onActivate={options.onActivate}
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
        <GtkColumnView
            ref={ref}
            model={model}
            singleClickActivate={options.isSingleClickActivating ?? false}
            onActivate={options.onActivate}
        >
            {columns}
        </GtkColumnView>,
    );

    return ref;
};

export {
    BUTTON_LABEL,
    ITEM_NAMES,
    ItemFactory,
    buttonFactory,
    itemFactory,
    renderColumnView,
    renderGridView,
    renderListView,
};
