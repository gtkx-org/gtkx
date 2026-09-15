import type * as GObject from "@gtkx/gi/gobject";
import type { ReactElement, ReactNode, RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkColumnView, GtkGridView, GtkLabel, GtkListView, GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import { createPortal } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef, useState, useSyncExternalStore } from "react";

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

type ItemEntry = { host: Gtk.ListItem; key: string; item: GObject.Object | null };
type ItemRenderer = (item: GObject.Object) => ReactNode;

type ItemStore = {
    getSnapshot: () => ItemEntry[];
    subscribe: (listener: () => void) => () => void;
    setup: (object: GObject.Object) => void;
    bind: (object: GObject.Object) => void;
    unbind: (object: GObject.Object) => void;
    teardown: (object: GObject.Object) => void;
};

const createItemStore = (): ItemStore => {
    let entries: ItemEntry[] = [];
    let nextKey = 0;
    const listeners: Set<() => void> = new Set();

    const update = (next: ItemEntry[]): void => {
        entries = next;

        for (const listener of listeners) {
            listener();
        }
    };

    const setup = (object: GObject.Object): void => {
        if (object instanceof Gtk.ListItem) {
            update([...entries, { host: object, key: String(nextKey++), item: null }]);
        }
    };

    const updateItem = (object: GObject.Object, item: GObject.Object | null): void => {
        update(entries.map((entry) => entry.host === object ? { ...entry, item } : entry));
    };

    const bind = (object: GObject.Object): void => {
        if (object instanceof Gtk.ListItem) {
            updateItem(object, object.getItem());
        }
    };

    const unbind = (object: GObject.Object): void => {
        updateItem(object, null);
    };

    const teardown = (object: GObject.Object): void => {
        update(entries.filter((entry) => entry.host !== object));
    };

    return {
        getSnapshot: () => entries,
        subscribe: (listener) => {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },
        setup,
        bind,
        unbind,
        teardown,
    };
};

function ItemFactory({ renderItem }: { renderItem: ItemRenderer }): ReactNode {
    const [store] = useState(createItemStore);
    const entries = useSyncExternalStore(store.subscribe, store.getSnapshot);

    return (
        <>
            <GtkSignalListItemFactory
                onSetup={store.setup}
                onBind={store.bind}
                onUnbind={store.unbind}
                onTeardown={store.teardown}
            />
            {entries.map((entry) => createPortal(
                entry.item === null ? null : renderItem(entry.item), entry.host, entry.key,
            ))}
        </>
    );
}

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
